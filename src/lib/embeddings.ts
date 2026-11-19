import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Tokenizer } from "@huggingface/tokenizers";
import { InferenceSession, Tensor } from "onnxruntime-node";

export const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
const EMBEDDING_DIMENSIONS = 384;
const MAX_TOKENS = 512;
const MODEL_DIRECTORY = join(process.cwd(), "src/models/bge-small-en-v1.5");

async function loadModel() {
  const [tokenizerJson, tokenizerConfigJson, session] = await Promise.all([
    readFile(join(MODEL_DIRECTORY, "tokenizer.json"), "utf8"),
    readFile(join(MODEL_DIRECTORY, "tokenizer_config.json"), "utf8"),
    InferenceSession.create(join(MODEL_DIRECTORY, "model_quantized.onnx"), {
      executionProviders: ["cpu"],
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
    }),
  ]);

  const tokenizer = new Tokenizer(
    JSON.parse(tokenizerJson),
    JSON.parse(tokenizerConfigJson),
  );
  return { tokenizer, session };
}

let model: ReturnType<typeof loadModel> | undefined;

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ").trim();
  model ??= loadModel().catch((error) => {
    model = undefined;
    throw error;
  });

  const { tokenizer, session } = await model;
  const encoded = tokenizer.encode(input, { add_special_tokens: true }).ids;
  // Keep BERT's final separator token when truncating a long note.
  const ids =
    encoded.length > MAX_TOKENS
      ? [...encoded.slice(0, MAX_TOKENS - 1), encoded[encoded.length - 1]]
      : encoded;
  const shape = [1, ids.length];

  const result = await session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), shape),
    attention_mask: new Tensor(
      "int64",
      new BigInt64Array(ids.length).fill(BigInt(1)),
      shape,
    ),
    token_type_ids: new Tensor("int64", new BigInt64Array(ids.length), shape),
  });

  const hidden = result.last_hidden_state;
  if (
    !hidden ||
    !(hidden.data instanceof Float32Array) ||
    hidden.dims.length !== 3 ||
    hidden.dims[2] !== EMBEDDING_DIMENSIONS
  ) {
    throw new Error("Unexpected BGE model output");
  }

  // BGE pools the first (CLS) token and normalizes it for cosine search.
  const vector = hidden.data.subarray(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Invalid BGE embedding norm");
  }
  return Array.from(vector, (value) => value / norm);
}
