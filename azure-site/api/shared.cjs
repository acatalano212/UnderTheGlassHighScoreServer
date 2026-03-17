// Shared score store with Azure Blob Storage persistence
// In-memory cache for fast reads, blob storage for persistence across deploys
const { BlobServiceClient } = require("@azure/storage-blob");

let scoreData = null;
const CONTAINER = "scores";
const BLOB_NAME = "scores.json";

function getBlobClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) return null;
  const blobService = BlobServiceClient.fromConnectionString(connStr);
  return blobService.getContainerClient(CONTAINER).getBlockBlobClient(BLOB_NAME);
}

module.exports = {
  getScores() {
    return scoreData;
  },

  async loadFromBlob() {
    if (scoreData) return scoreData;
    try {
      const client = getBlobClient();
      if (!client) return null;
      const resp = await client.download(0);
      const chunks = [];
      for await (const chunk of resp.readableStreamBody) {
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString());
      scoreData = data;
      return data;
    } catch (err) {
      if (err.statusCode === 404) return null;
      console.error("Blob read error:", err.message);
      return null;
    }
  },

  async setScores(data) {
    scoreData = {
      ...data,
      _pushed_at: new Date().toISOString(),
    };
    try {
      const client = getBlobClient();
      if (client) {
        const json = JSON.stringify(scoreData);
        await client.upload(json, json.length, {
          overwrite: true,
          blobHTTPHeaders: { blobContentType: "application/json" },
        });
      }
    } catch (err) {
      console.error("Blob write error:", err.message);
    }
  },
};
