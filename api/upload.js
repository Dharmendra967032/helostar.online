const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = "Dharmendra967032";
const REPO = "helostar.online";
const DB_PATH = "database.json";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { fileName, content, description, owner, method, videoId } = req.body;

  try {
    // Fetch the current database.json first
    const { data: dbFile } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: DB_PATH });
    let dbData = JSON.parse(Buffer.from(dbFile.content, 'base64').toString());

    if (method === 'UPLOAD_VIDEO') {
      // 1. Upload Video File
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: fileName,
        message: `Upload video: ${fileName}`,
        content: content,
      });

      // 2. Add to JSON
      dbData.videos.push({
        id: Date.now().toString(),
        url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${fileName}`,
        storagePath: fileName,
        description, owner,
        createdAt: new Date().toISOString()
      });
    } 
    
    else if (method === 'DELETE_VIDEO') {
      const videoToDelete = dbData.videos.find(v => v.id === videoId);
      if (!videoToDelete) return res.status(404).json({ error: "Video not found" });

      // 1. Delete the actual video file
      try {
        const { data: fileData } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: videoToDelete.storagePath });
        await octokit.repos.deleteFile({
          owner: OWNER, repo: REPO, path: videoToDelete.storagePath,
          message: `Delete video: ${videoToDelete.storagePath}`,
          sha: fileData.sha
        });
      } catch (e) { console.log("File already gone or error deleting file"); }

      // 2. Remove from JSON
      dbData.videos = dbData.videos.filter(v => v.id !== videoId);
    }

    // Push the updated database.json back to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: DB_PATH,
      message: "Database Update",
      content: Buffer.from(JSON.stringify(dbData, null, 2)).toString('base64'),
      sha: dbFile.sha
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}