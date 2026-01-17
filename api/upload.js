import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { fileName, content, description, owner } = req.body;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = "Dharmendra967032";
    const REPO_NAME = "helostar.online";

    try {
        // Upload to GitHub
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${fileName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Upload video via Helostar",
                content: content
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText);
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}