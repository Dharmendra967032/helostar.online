export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileName, content, description, owner, method } = req.body;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = "Dharmendra967032";
    const REPO_NAME = "helostar.online";

    try {
        // 1. Upload Video to GitHub
        const uploadRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${fileName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload ${fileName}`,
                content: content
            })
        });

        if (!uploadRes.ok) {
            const error = await uploadRes.text();
            throw new Error(`GitHub Upload Failed: ${error}`);
        }

        // 2. Fetch and Update database.json
        const dbRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/database.json`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
        });
        const dbData = await dbRes.json();
        const dbContent = JSON.parse(Buffer.from(dbData.content, 'base64').toString());

        dbContent.videos.push({
            id: Date.now().toString(),
            url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${fileName}`,
            description,
            owner
        });

        await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/database.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Update database",
                content: Buffer.from(JSON.stringify(dbContent, null, 2)).toString('base64'),
                sha: dbData.sha
            })
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}