const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { compileFunction } = require('node:vm');
const ts = require('typescript');

const owner = '34ebc090-4336-426b-be5a-f3a7d242ba07';
const otherOwner = 'd292d56b-39d5-4b4c-8a78-2a61bc69c31b';
const phoneId = 'ab1de413-0061-40c8-887e-8d733a2b9ef5';
const projectId = 'cbed0b2f-fcaf-431e-9169-0ac17e62a59e';
const foreignId = '185fd9f7-9467-4a82-924c-a514d05dc7a1';
const oldPhone = '202-555-0164';
const newPhone = '555010123';
const phoneText = (value) => `Contact details\nPhone: ${value}.\nCall after 5 pm.`;
const correction = `i changed to a new number, this is my current number "${newPhone}"`;
const phoneQuestion = 'what is my phone number';
const projectQuestion = 'What did the project decision say?';
const projectNote = 'The project decision was to ship a search prototype first.';

// Load production modules with the existing TypeScript compiler. Only the
// external model and embedding implementation are replaced in these tests.
function loadChatTurn(completions, embeddingError) {
  const modules = new Map();
  const sourceRoot = resolve(__dirname, '../src');

  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    const filename = resolve(sourceRoot, `${path}.ts`);
    const module = { exports: {} };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const requireSource = (name) => {
      if (name === 'server-only') return {};
      if (name === '@/lib/embeddings') return { generateEmbedding: async (text) => {
        const unavailable = typeof embeddingError === 'function' ? embeddingError(text) : embeddingError;
        if (unavailable) throw new Error('Synthetic embedding outage');
        return [1, 0, 0];
      } };
      if (name === '@/lib/openai') return { openai: { chat: { completions } } };
      if (name.startsWith('@/')) return load(name.slice(2));
      return require(name);
    };
    modules.set(path, module);
    compileFunction(outputText, ['require', 'module', 'exports'], { filename })(requireSource, module, module.exports);
    return module.exports;
  }

  return load('lib/chat-turn').runChatTurn;
}

function memory(id, content, userId = owner, title = null) {
  return { id, content, user_id: userId, title, tags: ['test'], embedding: '[1,0,0]', created_at: '2026-01-01T00:00:00.000Z' };
}

function fixture({ plan, evidence, beforeUpdate, writeError, embeddingError } = {}) {
  const rows = [
    memory(phoneId, phoneText(oldPhone)),
    memory(projectId, projectNote, owner, 'Project decision'),
    memory(foreignId, 'Phone: 202-555-0176.', otherOwner),
  ];
  const modelCalls = [];
  const mutations = [];
  const history = [];

  function from(table) {
    const records = table === 'memories' ? rows : history;
    const filters = [];
    let limit = Infinity;
    let insert;
    let update;
    function execute(single) {
      if (insert) {
        if (records.some((record) => record.id && record.id === insert.id)) {
          return { data: null, error: { code: '23505' } };
        }
        const record = { created_at: '2026-01-01T00:00:00.000Z', ...insert };
        records.push(record);
        if (table === 'memories') mutations.push('insert');
        return { data: single ? structuredClone(record) : [structuredClone(record)], error: null };
      }
      if (update) {
        beforeUpdate?.(rows);
        if (writeError) return { data: null, error: { code: 'XX000' } };
      }
      const matching = records.filter((record) => filters.every((filter) => filter(record))).slice(0, limit);
      if (update) matching.forEach((record) => {
        Object.assign(record, update);
        mutations.push('update');
      });
      return { data: structuredClone(single ? matching[0] ?? null : matching), error: null };
    }
    return {
      select() { return this; },
      eq(column, value) { filters.push((record) => record[column] === value); return this; },
      is(column, value) { return this.eq(column, value); },
      in(column, values) { filters.push((record) => values.includes(record[column])); return this; },
      ilike(column, pattern) {
        const fragment = pattern.replace(/^%|%$/g, '').replace(/\\([%_*\\])/g, '$1').toLowerCase();
        filters.push((record) => record[column]?.toLowerCase().includes(fragment));
        return this;
      },
      or(expression) {
        const alternatives = expression.split(',').map((filter) => {
          const [, column, value] = /^(title|content)\.ilike\.%([^%]+)%$/.exec(filter);
          return (record) => record[column]?.toLowerCase().includes(value);
        });
        filters.push((record) => alternatives.some((matches) => matches(record)));
        return this;
      },
      limit(count) { limit = count; return this; },
      order() { return this; },
      update(values) { update = values; return this; },
      insert(values) { insert = values; return this; },
      async single() { return execute(true); },
      async maybeSingle() { return execute(true); },
      then(onfulfilled) { return Promise.resolve(execute(false)).then(onfulfilled); },
    };
  }

  const client = {
    from,
    async rpc(name) {
      assert.equal(name, 'match_memories');
      return { data: [{ ...rows.find((row) => row.id === projectId), similarity: 0.9 }], error: null };
    },
  };
  const runChatTurn = loadChatTurn({
    async create(request) {
      const schema = request.response_format?.json_schema?.name;
      modelCalls.push(schema);
      const selected = schema === 'chat_message_plan' ? plan : evidence;
      const response = typeof selected === 'function' ? selected(request) : selected;
      if (!response) throw new Error('Synthetic model outage');
      return { choices: [{ message: { content: JSON.stringify(response) } }] };
    },
  }, embeddingError);

  return {
    run: (message, options = {}) => runChatTurn(client, owner, {
      message, mode: 'auto', strictness: 0.4, maxSources: 5, models: ['fixture'], ...options,
    }),
    rows,
    modelCalls,
    mutations,
  };
}

const updateReceipt = [{ id: phoneId, title: null, action: 'updated' }];
const searchPlan = (searchText, facts = []) => ({
  needsMemory: Boolean(searchText), searchText, updateRequested: false, update: null, conversation: 'other', facts,
});

test('the reported declaration updates the original note with no prior chat or model', async () => {
  const { run, rows, modelCalls, mutations } = fixture();
  const prior = await run(phoneQuestion);
  assert.match(prior.answer, /202-555-0164/);

  const updated = await run(correction);
  assert.deepEqual(updated.meta?.memoryChanges, updateReceipt);
  assert.equal(updated.changedMemories?.[0].id, phoneId);
  assert.equal(rows.find((row) => row.id === phoneId).content, phoneText(newPhone));
  assert.deepEqual(rows.find((row) => row.id === phoneId).tags, ['test']);
  assert.equal(rows.find((row) => row.id === foreignId).content, 'Phone: 202-555-0176.');

  const retried = await run(correction, { reference: { question: projectQuestion, sourceIds: [projectId] } });
  assert.equal(retried.meta?.memoryChanges?.length ?? 0, 0);
  assert.deepEqual(mutations, ['update']);
  const recalled = await run(phoneQuestion);
  assert.match(recalled.answer, /555010123/);
  assert.doesNotMatch(recalled.answer, /202-555-0164/);
  assert.deepEqual(recalled.sources.map((source) => source.id), [phoneId]);
  assert.deepEqual(modelCalls, []);
});

test('a failed database write cannot yield a receipt or change a later answer', async () => {
  const { run, mutations } = fixture({ writeError: true });
  const result = await run(correction);
  assert.equal(result.meta?.memoryChanges?.length ?? 0, 0);
  assert.doesNotMatch(result.answer, /\bI (?:updated|saved|noted)\b/i);
  assert.deepEqual(mutations, []);
  assert.match((await run(phoneQuestion)).answer, /202-555-0164/);
});

test('a local embedding outage cannot prevent a verified contact correction', async () => {
  const { run, rows, modelCalls } = fixture({ embeddingError: true });
  const result = await run(correction);
  assert.deepEqual(result.meta?.memoryChanges, updateReceipt);
  assert.equal(rows.find((row) => row.id === phoneId).embedding, null);
  assert.match((await run(phoneQuestion)).answer, /555010123/);
  assert.deepEqual(modelCalls, []);
});

test('a read-only turn and an ambiguous replacement produce no write receipt', async () => {
  const { run, mutations } = fixture();
  const replay = await run(correction, { mode: 'read-only' });
  assert.equal(replay.meta?.memoryChanges?.length ?? 0, 0);
  const ambiguous = await run('Change my phone number to 202-555-0182 or 202-555-0192.');
  assert.equal(ambiguous.meta?.memoryChanges?.length ?? 0, 0);
  assert.deepEqual(mutations, []);
  assert.match((await run(phoneQuestion)).answer, /202-555-0164/);
});

test('a concurrent notebook edit cannot be overwritten using a stale read', async () => {
  const { run, rows, mutations } = fixture({ beforeUpdate(notes) {
    notes.find((row) => row.id === phoneId).content = phoneText('202-555-0138');
  } });
  const result = await run(correction);
  assert.equal(result.meta?.memoryChanges?.length ?? 0, 0);
  assert.equal(rows.find((row) => row.id === phoneId).content, phoneText('202-555-0138'));
  assert.deepEqual(mutations, []);
});

test('a false save claim fabricated by the answer model gets rejected', async () => {
  const fabricated = "I've noted and saved your new phone number.";
  const { run, modelCalls, mutations } = fixture({
    plan: searchPlan(projectQuestion), evidence: { evidence: [{ source: 1, quote: fabricated }] },
  });
  const result = await run(projectQuestion);
  assert.ok(modelCalls.includes('notebook_evidence'));
  assert.ok(!result.answer.includes(fabricated));
  assert.equal(result.meta?.memoryChanges?.length ?? 0, 0);
  assert.deepEqual(mutations, []);
});

test('one turn can update a contact and answer a separate notebook question', async () => {
  const { run, mutations } = fixture({
    plan: searchPlan(projectQuestion), evidence: { evidence: [{ source: 1, quote: projectNote }] },
  });
  const result = await run(`Change my phone number to ${newPhone}. ${projectQuestion}`);
  assert.deepEqual(result.meta?.memoryChanges, updateReceipt);
  assert.ok(result.answer.includes(projectNote));
  assert.deepEqual(result.sources.map((source) => source.id), [projectId]);
  assert.deepEqual(mutations, ['update']);
});

test('a supported automatic addition is persisted and only acknowledged once', async () => {
  const detail = 'I keep my green backpack by the back door.';
  const { run, rows, mutations } = fixture({ plan: searchPlan('', [{ title: 'Backpack storage', content: detail }]) });
  const result = await run(detail);
  const [receipt] = result.meta?.memoryChanges ?? [];
  assert.equal(receipt?.action, 'saved');
  assert.equal(rows.find((row) => row.id === receipt?.id)?.content, detail);
  assert.equal((await run(detail)).meta?.memoryChanges?.length ?? 0, 0);
  assert.deepEqual(mutations, ['insert']);
});

test('an unindexed new detail can be found despite unrelated semantic results', async () => {
  const detail = 'I keep my green backpack by the back door.';
  const { run, rows } = fixture({
    plan: searchPlan('', [{ title: 'Backpack storage', content: detail }]),
    embeddingError: (text) => text.includes('Backpack storage'),
    evidence(request) {
      const { notes } = JSON.parse(request.messages.at(-1).content);
      const found = notes.find((note) => note.content === detail);
      return { evidence: found ? [{ source: found.source, quote: detail }] : [] };
    },
  });
  const { changedMemories } = await run(detail);
  const [created] = changedMemories;
  assert.equal(rows.find((row) => row.id === created.id)?.embedding, null);
  const recalled = await run('Where do I keep my green backpack?');
  assert.ok(recalled.answer.includes(detail));
  assert.deepEqual(recalled.sources.map((source) => source.id), [created.id]);
});
