const SUPABASE_URL = "https://axufucktgyuorwqcykkq.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Vuq82ePGI4vrov2ObLhJQQ_eZRtgkG5"; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentMode = 'long'; // Default to Portrait Feed

async function switchMode(mode, element) {
    currentMode = mode;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    const container = document.getElementById('videoContainer');
    container.className = `feed-layout mode-${mode}`;
    
    fetchVideos();
}

async function fetchVideos() {
    const { data, error } = await _supabase
        .from('videos')
        .select('*')
        .eq('mode', currentMode)
        .order('created_at', { ascending: false });

    const container = document.getElementById('videoContainer');
    container.innerHTML = data?.map(v => `
        <div class="video-card">
            <div class="video-wrapper">
                <video src="${v.url}" controls playsinline></video>
            </div>
            <div style="padding: 15px;">
                <h4 style="margin:0">${v.description}</h4>
                <p style="color:#666; font-size: 0.8rem;">@${v.owner.split('@')[0]}</p>
            </div>
        </div>
    `).join('') || '<p>No videos found</p>';
}

function triggerUpload() { document.getElementById('fileUpload').click(); }

document.getElementById('fileUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
        // LOGIC: Portrait = long, Landscape = short
        const isPortrait = video.videoHeight > video.videoWidth;
        const assignedMode = isPortrait ? 'long' : 'short';
        
        const caption = prompt(`Detected ${isPortrait ? 'Portrait' : 'Landscape'}. Caption:`);
        if (caption === null) return;

        uploadFile(file, assignedMode, caption);
    };
});

async function uploadFile(file, mode, desc) {
    const progressBar = document.querySelector('.progress-fill');
    document.getElementById('uploadProgress').style.display = 'block';

    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await _supabase.storage.from('video-uploads').upload(fileName, file);

    if (error) return alert("Upload Error");

    const { data: { publicUrl } } = _supabase.storage.from('video-uploads').getPublicUrl(fileName);

    await _supabase.from('videos').insert([{
        url: publicUrl,
        description: desc,
        owner: localStorage.getItem('guestUser') || 'anonymous',
        mode: mode
    }]);

    location.reload();
}

// Initialize
fetchVideos();