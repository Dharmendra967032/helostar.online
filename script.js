// --- CONFIG ---
    const SUPABASE_URL = "https://axufucktgyuorwqcykkq.supabase.co"; 
    const SUPABASE_ANON_KEY = "sb_publishable_Vuq82ePGI4vrov2ObLhJQQ_eZRtgkG5"; 

    firebase.initializeApp({
      apiKey: "AIzaSyAd_Gds3NO1NuiWWE7kOUST_epBn_cs2xY",
      authDomain: "helostar-134d9.firebaseapp.com",
      projectId: "helostar-134d9"
    });

    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let currentUserEmail = null;
    let currentTab = 'short';
    let currentCat = 'All';
    let isGuest = false;

    // --- AUTH ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) { 
            currentUserEmail = user.email;
            document.getElementById('userDisplay').innerHTML = `<i class="fas fa-user-circle"></i> ${user.displayName || user.email.split('@')[0]}`;
            start(false); 
        } else if (localStorage.getItem('guest')) {
            start(true);
        }
    });

// --- AUTO-PLAY / AUTO-PAUSE LOGIC ---
    const observerOptions = { threshold: 0.6 };
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const vid = entry.target;
            if (entry.isIntersecting) {
                vid.play().catch(() => {});
                incrementView(vid.dataset.id);
            } else {
                vid.pause();
            }
        });
    }, observerOptions);

    function start(g) {
        isGuest = g;
        document.getElementById('authOverlay').classList.add('hidden');
        if(isGuest) {
            document.getElementById('logoutMenuBtn').classList.add('hidden');
            document.getElementById('userDisplay').innerHTML = `<i class="fas fa-user-secret"></i> Guest Mode`;
        } else {
            document.getElementById('uploadBtn').style.display = 'flex';
        }
        renderFeed();
    }

    // --- UPLOAD LOGIC ---
    async function handleUpload() {
    if(isGuest) return alert("Please login to upload!");
    
    const videoIn = document.getElementById('fileIn');
    videoIn.onchange = async (e) => {
        const videoFile = e.target.files[0];
        if(!videoFile) return;

        // Step 2: Select Thumbnail
        const thumbIn = document.createElement('input');
        thumbIn.type = 'file'; thumbIn.accept = 'image/*';
        alert("Video selected! Now select a Thumbnail image (Cover).");
        
        thumbIn.onchange = async (te) => {
            const thumbFile = te.target.files[0];
            if(!thumbFile) return alert("Thumbnail is required!");
            const desc = prompt("Enter video description:");
const category = prompt("Enter category (Comedy, Party, Bhakti, Tech, Love, Sad, Others etc):") || 'All';
            const timestamp = Date.now();
            const vName = `vid_${timestamp}`;
            const tName = `thumb_${timestamp}`;

            alert("Uploading... Please wait.");

            // 1. Upload Video to 'videos' bucket
            await _supabase.storage.from('videos').upload(vName, videoFile);
            const vUrl = _supabase.storage.from('videos').getPublicUrl(vName).data.publicUrl;

            // 2. Upload Thumbnail to 'thumbnails' bucket
            const { error: tErr } = await _supabase.storage.from('thumbnails').upload(tName, thumbFile);
            if(tErr) return alert("Thumbnail upload failed. Make sure 'thumbnails' bucket exists!");
            
            const tUrl = _supabase.storage.from('thumbnails').getPublicUrl(tName).data.publicUrl;

            // 3. Save to Database
            await _supabase.from('videos').insert([{
                url: vUrl,
                thumbnail_url: tUrl,
                description: desc || "No description",
                owner: currentUserEmail,
                category: currentCat
            }]);

            alert("Upload Success!");
            renderFeed();
        };
        thumbIn.click();
    };
    videoIn.click();
}
    // --- INTERACTIONS ---
    async function incrementView(id) {
        // Calls the SQL function created in Supabase
        await _supabase.rpc('increment_views', { row_id: id });
    }
    // --- FEED LOGIC ---
    async function renderFeed() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const feed = document.getElementById('feed');
        feed.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.4;">Loading...</p>';
        
        let q = _supabase.from('videos').select('*').order('created_at', {ascending: false});
        if (currentCat !== 'All') q = q.eq('category', currentCat);
        
        const { data: videos } = await q;
        feed.innerHTML = '';
        if(!videos) return;

        const filtered = videos.filter(v => 
            v.description.toLowerCase().includes(searchTerm) || 
            v.owner.toLowerCase().includes(searchTerm)
        );

        filtered.forEach(v => {
            const vTemp = document.createElement('video');
            vTemp.src = v.url;
            vTemp.onloadedmetadata = () => {
                const isVertical = vTemp.videoHeight > vTemp.videoWidth;
                if ((currentTab === 'short' && isVertical) || (currentTab === 'full' && !isVertical)) {
                    createCard(v, isVertical);
                }
            };
        });
    }

    function createCard(v, isVertical) {
        const card = document.createElement('div');
        card.className = 'card';

        const isOwner = currentUserEmail === v.owner;
        const followBtn = !isOwner ?
        
        `<button class="btn-follow" data-creator="${v.owner}" onclick="toggleFollow('${v.owner}', this)">Follow</button>` : '';
        card.innerHTML = `
        <div class="card-header">
            <img src="${v.profiles?.avatar_url || 'https://via.placeholder.com/150'}" class="user-avatar"
            style="${isOwner ? 'cursor:pointer' : ''}"
            onclick="${isOwner ? 'updateProfilePicture()' : ''}">

            
            <div style="flex:1; font-weight:bold; font-size:0.9rem;">@${v.owner.split('@')[0]}</div>
            ${followBtn}
        </div>
            
            <div class="v-wrap ${isVertical ? 'v-short' : 'v-full'}">
            <video data-id="${v.id}" src="${v.url}" poster="${v.thumbnail_url || ''}"
            ${!isVertical ? 'controls' : 'loop playsinline onclick="togglePlay(this)"' }></video>
              
               
            </div>
            
            <div class="action-row" ${isVertical ? 'style="position:relative;"' : ''}>
                <button class="btn-act like-btn" data-id="${v.id}" data-liked="false" onclick="event.stopPropagation(); handleLike(this, '${v.id}')">
                    <i class="fas fa-heart"></i> <span class="count">${v.likes || 0}</span>
                </button>
                <button class="btn-act" onclick="event.stopPropagation(); toggleComments('${v.id}')">
                    <i class="fas fa-comment"></i> <span class="comment-count" data-id="${v.id}">0</span>
                </button>
                <button class="btn-act">
                    <i class="fas fa-eye"></i> <span class="view-count" data-id="${v.id}">${v.views || 0}</span>
                </button>
                <button class="btn-act" onclick="event.stopPropagation(); handleShare('${v.url}', '${v.description}')">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            
            <div id="comm-panel-${v.id}" class="comm-panel">
                <div id="list-${v.id}" class="comm-list"></div>
                <div class="comm-input-wrap">
                    <input type="text" id="input-${v.id}" class="comm-input" placeholder="Add comment...">
                    <button class="comm-post-btn" onclick="postComment('${v.id}')"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
            <div style="padding:0 15px 15px 15px;">
                <b>@${v.owner?.split('@')[0]}</b> ${v.description}
                <div style="color:var(--helostar-pink); font-size:0.75rem; margin-top:5px;">#${v.category}</div>
            </div>...`;
        document.getElementById('feed').appendChild(card);
        
        // Attach video reference and auto-play/pause logic
        const videoElem = card.querySelector('video');
        const vWrap = card.querySelector('.v-wrap');
        const actionRow = card.querySelector('.action-row');
        
        videoElem.onplay = () => pauseAllOtherVideos(videoElem);
        videoElem.onended = () => playNextVideo(card);
        videoObserver.observe(videoElem);
        
        // Add double-click fullscreen for shorts
        if(isVertical) {
            vWrap.ondblclick = () => toggleFullscreenShort(card, vWrap, actionRow);
            
            // Add swipe/touch detection for shorts
            let touchStartY = 0;
            vWrap.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            }, false);
            
            vWrap.addEventListener('touchend', (e) => {
                const touchEndY = e.changedTouches[0].clientY;
                const diff = touchStartY - touchEndY;
                
                if(diff > 50) {
                    // Swiped up - go to next video
                    playNextVideo(card);
                } else if(diff < -50) {
                    // Swiped down - go to previous video
                    const prevCard = card.previousElementSibling;
                    if(prevCard && prevCard.classList.contains('card')) {
                        prevCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, false);
        }
        
        // Load initial comments count and check if user liked
        loadCommentsCount(v.id);
        checkUserLike(v.id);
    }

    function pauseAllOtherVideos(currentVideo) {
        document.querySelectorAll('video').forEach(vid => {
            if (vid !== currentVideo) vid.pause();
        });
    }

    function playNextVideo(currentCard) {
        const nextCard = currentCard.nextElementSibling;
        while(nextCard && !nextCard.classList.contains('card')) {
            nextCard = nextCard.nextElementSibling;
        }
        
        if (nextCard && nextCard.classList.contains('card')) {
            const nextVideo = nextCard.querySelector('video');
            if (nextVideo) {
                // Check if we're in fullscreen mode
                const isInFullscreen = currentCard.classList.contains('fullscreen-active');
                
                if(isInFullscreen) {
                    // Exit fullscreen when video ends
                    const vWrap = currentCard.querySelector('.v-wrap');
                    const actionRow = currentCard.querySelector('.action-row');
                    if(vWrap && vWrap.classList.contains('fullscreen-short')) {
                        toggleFullscreenShort(currentCard, vWrap, actionRow);
                    }
                }
                
                // Auto-swipe/scroll to next video
                setTimeout(() => {
                    nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 200);
                
                // Auto-play next video
                setTimeout(() => {
                    nextVideo.play().catch(() => {});
                }, 1200);
            }
        }
        
    }

    // --- INTERACTIONS ---
    async function incrementView(id) {
        const viewSpan = document.querySelector(`.view-count[data-id="${id}"]`);
        if(viewSpan && !viewSpan.dataset.counted) {
            viewSpan.dataset.counted = 'true';
            let currentViews = parseInt(viewSpan.innerText);
            viewSpan.innerText = currentViews + 1;
            await _supabase.from('videos').update({ views: currentViews + 1 }).eq('id', id);
        }
    }

    async function handleLike(btn, id) {
        if(isGuest) return alert("Login to like!");
        
        const isAlreadyLiked = btn.dataset.liked === 'true';
        if(isAlreadyLiked) return alert("You already liked this video!");

        btn.classList.toggle('liked');
        btn.dataset.liked = 'true';
        const countSpan = btn.querySelector('.count');
        let currentLikes = parseInt(countSpan.innerText);
        
        const newLikes = currentLikes + 1;
        countSpan.innerText = newLikes;

        // Save like to database with user email
        await _supabase.from('videos').update({ likes: newLikes }).eq('id', id);
        
        // Save like record to track user likes
        await _supabase.from('likes').insert([{
            video_id: id,
            user_email: currentUserEmail
        }]).select();
    }

    async function checkUserLike(videoId) {
        if(isGuest) return;
        const { data } = await _supabase.from('likes').select('*').eq('video_id', videoId).eq('user_email', currentUserEmail);
        
        if(data && data.length > 0) {
            const likeBtn = document.querySelector(`.like-btn[data-id="${videoId}"]`);
            if(likeBtn) {
                likeBtn.classList.add('liked');
                likeBtn.dataset.liked = 'true';
            }
        }
    }

    async function loadCommentsCount(videoId) {
        const { data } = await _supabase.from('comments').select('*').eq('video_id', videoId);
        const countSpan = document.querySelector(`.comment-count[data-id="${videoId}"]`);
        if(countSpan) {
            countSpan.innerText = data ? data.length : 0;
        }
    }

    function handleShare(url, desc) {
        if (navigator.share) {
            navigator.share({ title: 'Helostar', text: desc, url: url });
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    }

    function toggleComments(id) {
        const panel = document.getElementById(`comm-panel-${id}`);
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        if(panel.style.display === 'block') loadComments(id);
    }

    async function loadComments(id) {
        const list = document.getElementById(`list-${id}`);
        const { data } = await _supabase.from('comments').select('*').eq('video_id', id);
        
        if(data && data.length) {
            list.innerHTML = data.map(c => {
                return `<div class="comm-item">${c.comment_text}</div>`;
            }).join('');
        } else {
            list.innerHTML = '<div style="font-size:0.85rem; color:#888;">No comments yet.</div>';
        }
    }

    async function postComment(id) {
        if(isGuest) return alert("Please Login");
        const input = document.getElementById(`input-${id}`);
        if(!input.value.trim()) return;
        
        const commentText = input.value;
        input.value = '';
        input.disabled = true;
        
        try {
            const { error } = await _supabase.from('comments').insert([{ 
                video_id: id, 
                comment_text: commentText
            }]);
            
            if(error) throw error;
            
            await new Promise(r => setTimeout(r, 300));
            await loadComments(id);
            await loadCommentsCount(id);
        } catch(err) {
            console.error('Comment Error:', err);
            alert('Error posting comment: ' + err.message);
            input.value = commentText;
        } finally {
            input.disabled = false;
        }
    }
    function togglePlay(vid) { vid.paused ? vid.play() : vid.pause(); }
    
    function toggleMute(btn) {
        const vid = btn.closest('.v-wrap').querySelector('video');
        vid.muted = !vid.muted;
        btn.innerHTML = vid.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    }

    function toggleFullscreenShort(card, vWrap, actionRow) {
        const isFullscreen = vWrap.classList.contains('fullscreen-short');
        
        if(!isFullscreen) {
            // Enter fullscreen
            vWrap.classList.add('fullscreen-short');
            card.classList.add('fullscreen-active');
            actionRow.style.position = 'fixed';
            actionRow.style.bottom = '60px';
            actionRow.style.left = '15px';
            actionRow.style.right = '15px';
            actionRow.style.zIndex = '1000';
            actionRow.style.background = 'transparent';
            actionRow.style.width = 'auto';
            document.body.style.overflow = 'hidden';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            
            // Style action buttons to be transparent
            actionRow.querySelectorAll('.btn-act').forEach(btn => {
                btn.style.background = 'rgba(0,0,0,0.2)';
                btn.style.border = '1px solid rgba(255,255,255,0.15)';
            });
            
            // Hide other cards
            document.querySelectorAll('.card').forEach(c => {
                if(c !== card) c.style.display = 'none';
            });
            document.querySelector('header').style.display = 'none';
            document.querySelector('.nav-tabs').style.display = 'none';
        } else {
            // Exit fullscreen
            vWrap.classList.remove('fullscreen-short');
            card.classList.remove('fullscreen-active');
            actionRow.style.position = 'relative';
            actionRow.style.bottom = 'auto';
            actionRow.style.left = 'auto';
            actionRow.style.right = 'auto';
            actionRow.style.zIndex = 'auto';
            actionRow.style.background = 'transparent';
            actionRow.style.width = '100%';
            document.body.style.overflow = 'auto';
            document.body.style.margin = '';
            document.body.style.padding = '';
            
            // Reset button styles
            actionRow.querySelectorAll('.btn-act').forEach(btn => {
                btn.style.background = '';
                btn.style.border = '';
            });
            
            // Show all cards and UI
            document.querySelectorAll('.card').forEach(c => c.style.display = 'block');
            document.querySelector('header').style.display = 'block';
            document.querySelector('.nav-tabs').style.display = 'flex';
        }
    }
    
    // --- UI HELPERS ---
    function toggleSearch() {
        const container = document.getElementById('searchContainer');
        const logo = document.getElementById('headerLogo');
        container.classList.toggle('expanded');
        if(container.classList.contains('expanded')) {
            logo.style.opacity = '0';
            document.getElementById('searchInput').focus();
        } else { logo.style.opacity = '1'; }
    }
    function toggleMenu() { document.getElementById('catDropdown').classList.toggle('show'); }
    function filterByCat(cat) { currentCat = cat; toggleMenu(); renderFeed(); }
    function setTab(t) {
        currentTab = t;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(t === 'short' ? 'tShort' : 'tFull').classList.add('active');
        renderFeed();
    }
    function logout() { localStorage.clear(); firebase.auth().signOut().then(() => location.reload()); }
    function guestMode() { localStorage.setItem('guest', '1'); location.reload(); }
    function signInWithGoogle() { firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }

    window.onclick = function(event) {
        if (!event.target.matches('.menu-trigger') && !event.target.closest('.dropdown-content')) {
            const dropdowns = document.getElementsByClassName("dropdown-content");
            for (let d of dropdowns) { if (d.classList.contains('show')) d.classList.remove('show'); }
        }
    }

    async function toggleFollow(targetEmail, btn) {
    if (isGuest) return alert("Login to follow creators!");
    if (targetEmail === currentUserEmail) return alert("You cannot follow yourself!");

    const isFollowing = btn.classList.contains('following');
    
    if (isFollowing) {
        // Unfollow Logic
        const { error } = await _supabase.from('follows')
            .delete()
            .eq('follower_email', currentUserEmail)
            .eq('following_email', targetEmail);
        
        if (!error) {
            // Update UI for all cards belonging to this creator
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.remove('following');
                b.innerText = "Follow";
            });
        }
    } else {
        // Follow Logic
        const { error } = await _supabase.from('follows')
            .insert([{ follower_email: currentUserEmail, following_email: targetEmail }]);
        
        if (!error) {
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.add('following');
                b.innerText = "Following";
            });
        }
    }
}

// Triggered when user clicks the upload button
async function handleUpload() {
    if(isGuest) return alert("Please login to upload!");
    const videoIn = document.getElementById('fileIn');
    videoIn.onchange = async (e) => {
        

    const videoFile = e.target.files[0];
    if(!videoFile) return;

    const thumbIn = document.createElement('input');
    thumbIn.type = 'file'; thumbIn.accept = 'image/*';
    alert("Video selected! Now select a Thumbnail image (Cover).");

    
        
        // Create an image input on the fly for the thumbnail
 
        thumbIn.onchange = async (te) => {
            const thumbFile = te.target.files[0];
            if(!thumbFile) return alert("Thumbnail is required!");
            const desc = prompt("Enter video description:");
            const category = prompt("Category (Comedy, Party, Bhakti, Tech,  Sad, Love Others etc):") || 'All';
            
            const timestamp = Date.now();
       
        const vName = `vid_${timestamp}`;
        const tName = `thumb_${timestamp}`;
alert("Uploading... Please wait.");
           

            // Upload Video
            await _supabase.storage.from('videos').upload(vName, videoFile);
            const vUrl = _supabase.storage.from('videos').getPublicUrl(vName).data.publicUrl;

            // Upload Thumbnail
            const { error: tErr } = await _supabase.storage.from('thumbnails').upload(tName, thumbFile);
            if(tErr) return alert("Thumbnail upload failed. Make sure 'thumbnails' bucket exists!");
            const tUrl = _supabase.storage.from('thumbnails').getPublicUrl(tName).data.publicUrl;

            // Save to DB
            await _supabase.from('videos').insert([{
                url: vUrl,
                thumbnail_url: tUrl,
                description: desc,
                owner: currentUserEmail,
                category: category
            }]);

            alert("Uploaded successfully!");
            renderFeed();
        };
        thumbIn.click();
    };
    videoIn.click();
}

async function updateProfilePicture() {
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*';
    fileIn.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const fileName = `avatar_${Date.now()}`;
        const { data, error } = await _supabase.storage.from('avatars').upload(fileName, file);
        
        if(error) return alert("Avatar upload failed: " + error.message);
        const { data: urlData } = _supabase.storage.from('avatars').getPublicUrl(fileName);
        
        // Save to profiles table
        await _supabase.from('profiles').upsert({ 
            id: firebase.auth().currentUser.uid,
            email: currentUserEmail, 
            avatar_url: urlData.publicUrl 
        });
        
        alert("Profile picture updated!");
        location.reload();
    };
    fileIn.click();
}