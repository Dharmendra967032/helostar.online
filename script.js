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
            const userDisplay = document.getElementById('userDisplay');
            if(userDisplay) {
                userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${user.displayName || user.email.split('@')[0]}`;
            }
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
                // Pause all other videos before playing this one, but don't pause videos
                // that are currently in reels/fullscreen mode so they keep playing
                document.querySelectorAll('video').forEach(v => {
                    if(v !== vid) {
                        try {
                            const wrapper = v.closest('.v-wrap');
                            if (wrapper && (wrapper.classList.contains('reels-fs') || wrapper.classList.contains('fullscreen-short'))) {
                                // keep fullscreen shorts playing
                                return;
                            }
                            v.pause();
                            v.currentTime = 0;
                            v.muted = false;
                        } catch(e) {}
                    }
                });
                // Play this video
                try {
                    vid.muted = false;
                    vid.play().catch(() => {});
                } catch(e) {}
                incrementView(vid.dataset.id);
                } else {
                try {
                    // If video is currently in reels fullscreen / fullscreen-short, do not auto-pause it
                    // Also do NOT auto-pause vertical shorts (they should keep playing unless explicitly stopped elsewhere)
                    const wrapper = vid.closest('.v-wrap');
                    if (wrapper && (wrapper.classList.contains('reels-fs') || wrapper.classList.contains('fullscreen-short') || wrapper.classList.contains('v-short'))) {
                        return;
                    }
                    vid.pause();
                    vid.currentTime = 0;
                } catch(e) {}
            }
        });
    }, observerOptions);

    function start(g) {
        isGuest = g;
        const authOverlay = document.getElementById('authOverlay');
        if(authOverlay) authOverlay.classList.add('hidden');
        
        if(isGuest) {
            const logoutBtn = document.getElementById('logoutMenuBtn');
            if(logoutBtn) logoutBtn.classList.add('hidden');
            const userDisplay = document.getElementById('userDisplay');
            if(userDisplay) userDisplay.innerHTML = `<i class="fas fa-user-secret"></i> Guest Mode`;
        } else {
            const uploadBtn = document.getElementById('uploadBtn');
            if(uploadBtn) uploadBtn.style.display = 'flex';
        }
        renderFeed();
    }

    // --- UPLOAD LOGIC ---
    const fileInElement = document.getElementById('fileIn');
    if(fileInElement) {
        fileInElement.onchange = async (e) => {
            if(isGuest) return alert("Please login to upload!");
            const file = e.target.files[0];
            if(!file) return;

            const desc = prompt("Enter video description:");
            if(desc === null) return; // User cancelled description prompt
            
            const category = prompt("Enter category (Comedy, Party, Bhakti, Tech, Love, Sad, Others etc):") || 'All';
            
            let thumbnailUrl = null;
            let uploadAttempted = false;
            let uploadStarted = false;
            
            // Create temporary video element to generate thumbnail
            const tempVid = document.createElement('video');
            tempVid.src = URL.createObjectURL(file);
            
            tempVid.onloadedmetadata = async () => {
                // Generate thumbnail from video
                const canvas = document.createElement('canvas');
                canvas.width = tempVid.videoWidth;
                canvas.height = tempVid.videoHeight;
                const ctx = canvas.getContext('2d');
                tempVid.currentTime = 0.5; // Get frame at 0.5 seconds
            };
            
            tempVid.onseeked = async () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = tempVid.videoWidth;
                    canvas.height = tempVid.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempVid, 0, 0);
                    
                    // Convert canvas to blob
                    canvas.toBlob(async (blob) => {
                        try {
                            const thumbFileName = `thumb_${Date.now()}.jpg`;
                            const { error: thumbErr } = await _supabase.storage.from('thumbnails').upload(thumbFileName, blob);
                            
                            if(!thumbErr) {
                                const { data: thumbUrl } = _supabase.storage.from('thumbnails').getPublicUrl(thumbFileName);
                                thumbnailUrl = thumbUrl.publicUrl;
                                uploadAttempted = true;
                            }
                        } catch(err) {
                            console.error('Thumbnail upload error:', err);
                        }
                        uploadVideo();
                    }, 'image/jpeg');
                } catch(err) {
                    console.error('Thumbnail generation error:', err);
                    uploadVideo();
                }
            };
            
            tempVid.load();
            
            async function uploadVideo() {
                if (uploadStarted) return;
                uploadStarted = true;
                try {
                    const fileName = `${Date.now()}_${file.name}`;
                    
                    // 1. Upload to Supabase Storage
                    console.log('Starting video upload:', fileName);
                    const { error: uploadErr } = await _supabase.storage
                        .from('videos')
                        .upload(fileName, file);

                    if(uploadErr) {
                        console.error('Storage upload error:', uploadErr);
                        return alert("Upload failed: " + uploadErr.message);
                    }
                    
                    console.log('Video stored successfully');

                    // 2. Get Public URL
                    let urlData = null;
                    try {
                        urlData = _supabase.storage.from('videos').getPublicUrl(fileName);
                    } catch(urlErr) {
                        console.error('URL generation error:', urlErr);
                        return alert("Could not generate video URL");
                    }
                    
                    if(!urlData || !urlData.data) {
                        return alert("Could not get video URL");
                    }

                    // 3. Save to Database
                    console.log('Saving to database...');
                    const { error: dbErr } = await _supabase.from('videos').insert([{
                        url: urlData.data.publicUrl,
                        thumbnail_url: thumbnailUrl || '',
                        description: desc || "No description",
                        owner: currentUserEmail,
                        category: category,
                        likes: 0,
                        views: 0
                    }]);

                    if(dbErr) {
                        console.error('Database insert error:', dbErr);
                        return alert("Database error: " + dbErr.message);
                    }
                    
                    console.log('Upload complete!');
                    alert("Upload Success!");
                    renderFeed();
                } catch(err) {
                    console.error('Upload error:', err);
                    alert("Upload failed: " + err.message);
                }
            }
            
            // Create and click the thumbnail input so user can choose a cover image
            const thumbInput = document.createElement('input');
            thumbInput.type = 'file';
            thumbInput.accept = 'image/*';
            thumbInput.onchange = async (te) => {
                uploadAttempted = true;
                const thumbFile = te.target.files[0];
                if(!thumbFile) return uploadVideo();
                try {
                    const thumbFileName = `thumb_${Date.now()}_${thumbFile.name}`;
                    const { error: thumbErr } = await _supabase.storage.from('thumbnails').upload(thumbFileName, thumbFile);
                    if(!thumbErr) {
                        const { data: thumbUrl } = _supabase.storage.from('thumbnails').getPublicUrl(thumbFileName);
                        thumbnailUrl = thumbUrl.publicUrl;
                    }
                } catch(err) {
                    console.error('Thumbnail upload error (user file):', err);
                }
                uploadVideo();
            };
            thumbInput.click();
            
            // If no thumbnail is selected after 3 seconds, still upload
            setTimeout(() => {
                if(!uploadAttempted) {
                    uploadAttempted = true;
                    uploadVideo();
                }
            }, 3000);
        };
    }

    // --- INTERACTIONS ---
    async function incrementView(id) {
        // Calls the SQL function created in Supabase
        await _supabase.rpc('increment_views', { row_id: id });
    }
    // --- FEED LOGIC ---
    async function renderFeed() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const feed = document.getElementById('feed');
        if(!feed) return;
        
        feed.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.4;">Loading...</p>';
        
        let q = _supabase.from('videos').select('*').order('created_at', {ascending: false});
        if (currentCat !== 'All') q = q.eq('category', currentCat);
        
        const { data: videos } = await q;
        
        // Pre-fetch all user profiles/avatars in one query
        if(videos && videos.length > 0) {
            const uniqueEmails = [...new Set(videos.map(v => v.owner))];
            const { data: profiles } = await _supabase.from('profiles').select('email, avatar_url').in('email', uniqueEmails);
            window.profileAvatarMap = {};
            if(profiles) {
                profiles.forEach(p => {
                    window.profileAvatarMap[p.email] = p.avatar_url;
                });
            }
        }
        feed.innerHTML = '';
        if(!videos || videos.length === 0) {
            feed.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.4;">No videos found</p>';
            return;
        }

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
            vTemp.onerror = () => {
                console.error('Video load error:', v.url);
            };
        });
    }

    function createCard(v, isVertical) {
        const card = document.createElement('div');
        card.className = 'card';
        const followBtn = currentUserEmail !== v.owner ? 
        `<button class="btn-follow" data-creator="${v.owner}" data-video-id="${v.id}" onclick="toggleFollow('${v.owner}', this)"><span class="follow-text">Follow</span></button>` : `<span style="font-size:0.8rem; color:#999;">Your Video</span>`;
        
        // 3-dot menu for owner only
        const menuBtn = currentUserEmail === v.owner ? 
        `<div class="video-menu-wrapper">
            <button class="video-menu-btn" onclick="toggleVideoMenu(event, ${v.id})">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="video-menu-dropdown" id="menu-${v.id}" style="display: none;">
                <div class="video-menu-item" onclick="editDescription(${v.id}, null)">
                    <i class="fas fa-edit"></i> Edit Description
                </div>
                <div class="video-menu-item delete-item" onclick="deleteVideo(${v.id}, null)">
                    <i class="fas fa-trash"></i> Delete Video
                </div>
            </div>
        </div>` : '';
        
        const avatarUrl = window.profileAvatarMap && window.profileAvatarMap[v.owner] ? window.profileAvatarMap[v.owner] : 'https://via.placeholder.com/150';
        
        card.innerHTML = `
        <div class="card-header">
            <img src="${avatarUrl}" class="user-avatar" style="cursor: ${currentUserEmail === v.owner ? 'pointer' : 'default'};" data-email="${v.owner}" ${currentUserEmail === v.owner ? 'onclick="updateProfilePicture()"' : ''}>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.9rem;">@${v.owner.split('@')[0]}</div>
                <div class="follower-count" data-creator="${v.owner}" style="font-size:0.75rem; color:#999;">0 followers</div>
            </div>
            ${followBtn}
            ${menuBtn}
        </div>
            
            <div class="v-wrap ${isVertical ? 'v-short' : 'v-full'}">
                <video 
                src="${v.url}" 
                poster="${v.thumbnail_url || ''}" 
                ${isVertical ? 'loop playsinline' : 'controls'}
                ${isVertical ? '' : 'onclick="togglePlay(this)"'}
            ></video>
                ${isVertical ? '<div class="mute-center"><i class="fas fa-volume-mute"></i></div>' : ''}
               
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
                <button class="btn-act share-btn" onclick="event.stopPropagation(); handleShare('${v.url}', this)" data-desc="${v.description.replace(/"/g, '&quot;')}">
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
                <b>@${v.owner.split('@')[0]}</b> <span id="desc-${v.id}">${v.description}</span>
                <div style="color:var(--helostar-pink); font-size:0.75rem; margin-top:5px;">#${v.category}</div>
            </div>`;
        document.getElementById('feed').appendChild(card);

        // Add right-side action buttons only for vertical shorts
        if (isVertical) {
            const vwrapEl = card.querySelector('.v-wrap');
            if (vwrapEl) {
                const side = document.createElement('div');
                side.className = 'side-actions';

                // Like button
                const likeBtnSide = document.createElement('div');
                likeBtnSide.className = 'action-btn like-side';
                likeBtnSide.setAttribute('data-id', v.id);
                likeBtnSide.innerHTML = `<i class="fas fa-heart"></i><div class="small-count">${v.likes || 0}</div>`;
                likeBtnSide.addEventListener('click', (e) => { e.stopPropagation(); handleLike(likeBtnSide, v.id); likeBtnSide.classList.add('like-pop'); setTimeout(()=> likeBtnSide.classList.remove('like-pop'), 350); });

                // Comment button (opens fullscreen comments)
                const commBtnSide = document.createElement('div');
                commBtnSide.className = 'action-btn comm-side';
                commBtnSide.innerHTML = `<i class="fas fa-comment"></i><div class="small-count comment-count" data-id="${v.id}">0</div>`;
                commBtnSide.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreenComments(card, v.id); });

                // Views
                const viewBtnSide = document.createElement('div');
                viewBtnSide.className = 'action-btn view-side';
                viewBtnSide.innerHTML = `<i class="fas fa-eye"></i><div class="small-count view-count" data-id="${v.id}">${v.views || 0}</div>`;

                // Share
                const shareBtnSide = document.createElement('div');
                shareBtnSide.className = 'action-btn share-side';
                shareBtnSide.innerHTML = `<i class="fas fa-paper-plane"></i><div class="small-count">Share</div>`;
                shareBtnSide.addEventListener('click', (e) => { e.stopPropagation(); handleShareDirect(v.url, v.description); });

                side.appendChild(likeBtnSide);
                side.appendChild(commBtnSide);
                side.appendChild(viewBtnSide);
                side.appendChild(shareBtnSide);

                vwrapEl.appendChild(side);
            }
        }
        
        // Attach video reference and auto-play/pause logic
        const videoElem = card.querySelector('video');
        const vWrap = card.querySelector('.v-wrap');
        const actionRow = card.querySelector('.action-row');
        
        videoElem.onplay = () => pauseAllOtherVideos(videoElem);
        videoElem.onended = () => playNextVideo(card);
        videoObserver.observe(videoElem);
        
        // Instagram-style shorts experience
        if(isVertical) {
            // Unified touch handler for both taps and swipes
            let touchStartY = 0;
            let touchStartX = 0;
            let swiping = false;
            let isSwipeAttempt = false;
            let lastTapTime = 0;
            let lastTapX = 0;
            let lastTapY = 0;
            
            vWrap.addEventListener('touchstart', (e) => {
                if(swiping) return;
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
                isSwipeAttempt = false;
            }, { passive: true });
            
            vWrap.addEventListener('touchend', (e) => {
                if(swiping) return;
                
                const touchEndY = e.changedTouches[0].clientY;
                const touchEndX = e.changedTouches[0].clientX;
                const diffY = touchStartY - touchEndY;
                const diffX = touchStartX - touchEndX;
                const currentTime = new Date().getTime();
                const tapDuration = currentTime - lastTapTime;
                
                // Check if this is a vertical swipe (swipe-first priority)
                if(Math.abs(diffY) > 100 && Math.abs(diffY) > Math.abs(diffX)) {
                    // VERTICAL SWIPE
                    swiping = true;
                    isSwipeAttempt = true;
                    
                            if(diffY > 100) {
                        // SWIPE UP - next
                        let nextCard = card.nextElementSibling;
                        while(nextCard && !nextCard.classList.contains('card')) {
                            nextCard = nextCard.nextElementSibling;
                        }
                        if(nextCard) {
                            const nextVid = nextCard.querySelector('video');
                            // Pause ALL videos first
                            document.querySelectorAll('video').forEach(v => {
                                try {
                                    v.pause();
                                    v.currentTime = 0;
                                    v.muted = false;
                                } catch(err) {}
                            });
                                    // Suppress feedback while auto-scrolling/swapping
                                    window.suppressReelsFeedback = true;
                                    setTimeout(() => { window.suppressReelsFeedback = false; }, 900);

                            
                            // If in reels fullscreen, swap fullscreen to next card
                            if (vWrap.classList.contains('reels-fs')) {
                                swapFullscreenToCard(card, nextCard);
                            } else {
                                nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Auto-play after scroll completes
                                setTimeout(() => {
                                    if(nextVid && nextVid.paused) {
                                        nextVid.muted = false;
                                        nextVid.play().catch(err => console.log('Play error:', err));
                                    }
                                }, 100);
                            }
                        }
                    } else if(diffY < -100) {
                        // SWIPE DOWN - previous
                        let prevCard = card.previousElementSibling;
                        while(prevCard && !prevCard.classList.contains('card')) {
                            prevCard = prevCard.previousElementSibling;
                        }
                            if(prevCard) {
                            const prevVid = prevCard.querySelector('video');
                            // Pause ALL videos first
                            document.querySelectorAll('video').forEach(v => {
                                try {
                                    v.pause();
                                    v.currentTime = 0;
                                    v.muted = false;
                                } catch(err) {}
                            });
                                    // Suppress feedback while auto-scrolling/swapping
                                    window.suppressReelsFeedback = true;
                                    setTimeout(() => { window.suppressReelsFeedback = false; }, 900);

                            if (vWrap.classList.contains('reels-fs')) {
                                swapFullscreenToCard(card, prevCard);
                            } else {
                                prevCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Auto-play after scroll completes
                                setTimeout(() => {
                                    if(prevVid && prevVid.paused) {
                                        prevVid.muted = false;
                                        prevVid.play().catch(err => console.log('Play error:', err));
                                    }
                                }, 100);
                            }
                        }
                    }
                    
                    // Reset swipe flag after action
                    setTimeout(() => { swiping = false; }, 500);
                } else if(!isSwipeAttempt && Math.abs(diffY) < 100 && Math.abs(diffX) < 100) {
                    // TAP (small or no movement) - handle single/double tap
                    const touchX = e.changedTouches[0].clientX;
                    const touchY = e.changedTouches[0].clientY;
                    const rect = vWrap.getBoundingClientRect();
                    const relativeTouchX = touchX - rect.left;
                    const relativeWidth = rect.width;
                    const tapDistance = Math.hypot(touchX - lastTapX, touchY - lastTapY);
                    
                    // Check for double tap (within 300ms and 50px distance)
                    if (tapDuration < 300 && tapDistance < 50) {
                        // DOUBLE TAP - Like/Unlike
                        const likeBtn = card.querySelector(`.like-btn[data-id="${v.id}"]`);
                        if(likeBtn) {
                            likeBtn.click();
                            // Show heart animation at tap location
                            showHeartAnimation(touchX - rect.left, touchY - rect.top);
                        }
                        lastTapTime = 0; // Reset to prevent triple tap
                    } else {
                        // SINGLE TAP
                        lastTapTime = currentTime;
                        lastTapX = touchX;
                        lastTapY = touchY;
                        // Prefer a dedicated center mute toggle. Right side used to enter fullscreen,
                        // but for fixed-size shorts we disable fullscreen-on-right-tap so shorts remain fixed-size.
                        if (relativeTouchX > (relativeWidth * 2 / 3)) {
                            // RIGHT - do NOT expand. Treat same as center: toggle mute/unmute to avoid pausing/expansion.
                            videoElem.muted = !videoElem.muted;
                            showReelsFeedback(videoElem.muted ? 'mute' : 'unmute');
                        } else {
                            // CENTER / LEFT - toggle mute/unmute
                            videoElem.muted = !videoElem.muted;
                            showReelsFeedback(videoElem.muted ? 'mute' : 'unmute');
                        }
                    }
                }
            }, { passive: true });

            // Center mute button listener (if present)
            const muteCenterBtn = card.querySelector('.mute-center');
            if (muteCenterBtn) {
                muteCenterBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const vid = card.querySelector('video');
                    if(!vid) return;
                    vid.muted = !vid.muted;
                    showReelsFeedback(vid.muted ? 'mute' : 'unmute');
                    // update icon
                    const icon = muteCenterBtn.querySelector('i');
                    if(icon) icon.className = vid.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
                });
            }
        }
        
        // Load initial comments count and check if user liked
        loadCommentsCount(v.id);
        checkUserLike(v.id);
        checkUserFollow(v.owner);
        loadFollowerCount(v.owner, card);
        
        // Fetch and display user avatar
        fetchUserAvatar(v.owner, card);
        
        card.setAttribute('data-video-id', v.id);
    }

    async function loadFollowerCount(creatorEmail, card) {
        try {
            const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', creatorEmail);
            const followerCount = followers ? followers.length : 0;
            const followerEl = card.querySelector(`.follower-count[data-creator="${creatorEmail}"]`);
            if(followerEl) {
                followerEl.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
            }
        } catch(err) {
            console.error('Follower count error:', err);
        }
    }

    async function fetchUserAvatar(email, card) {
        try {
            // Use pre-fetched avatar from map
            if(window.profileAvatarMap && window.profileAvatarMap[email]) {
                const avatarImg = card.querySelector('.user-avatar');
                if(avatarImg) {
                    avatarImg.src = window.profileAvatarMap[email];
                }
            }
        } catch(err) {
            console.error('Avatar fetch error:', err);
        }
    }

    function pauseAllOtherVideos(currentVideo) {
        document.querySelectorAll('video').forEach(vid => {
            if (vid !== currentVideo) {
                try {
                    // Do not pause vertical shorts; they should keep playing
                    const wrapper = vid.closest('.v-wrap');
                    if (wrapper && wrapper.classList.contains('v-short')) return;
                    vid.pause();
                    vid.currentTime = 0;
                    vid.muted = false;
                } catch (e) {
                    console.error('Error pausing video:', e);
                }
            }
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
                
                // Auto-swipe/scroll to next video with minimal delay
                window.suppressReelsFeedback = true;
                setTimeout(() => { window.suppressReelsFeedback = false; }, 900);
                nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // The IntersectionObserver will auto-play when visible
                // Just ensure the video is ready and not muted
                setTimeout(() => {
                    if(nextVideo && nextVideo.paused) {
                        nextVideo.muted = false;
                        nextVideo.play().catch(() => {});
                    }
                }, 300);
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

    const likeCooldown = {}; // Track cooldown per video ID
    async function handleLike(btn, id) {
        if (isGuest || !currentUserEmail) return alert('Please login to like videos');

        // Cooldown check (500ms per video)
        if (likeCooldown[id]) {
            console.log('Like cooldown active');
            return;
        }
        likeCooldown[id] = true;
        setTimeout(() => { delete likeCooldown[id]; }, 500);

        // Disable button to prevent rapid clicks
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        }

        try {
            // Check existing like by this user FOR THIS VIDEO
            const { data: existing, error: checkErr } = await _supabase
                .from('likes')
                .select('*')
                .eq('video_id', id)
                .eq('user_email', currentUserEmail);

            if (checkErr) {
                console.error('Check like error:', checkErr);
                return;
            }

            const hCountEl = document.querySelector(`.like-btn[data-id=\"${id}\"] .count`);
            const sideCountEl = document.querySelector(`.side-actions .like-side[data-id=\"${id}\"] .small-count`);

            if (existing && existing.length > 0) {
                // User already liked -> perform UNLIKE
                const { error: delErr } = await _supabase.from('likes').delete().eq('video_id', id).eq('user_email', currentUserEmail);
                if (delErr) console.error('Unlike delete error:', delErr);
            } else {
                // Perform LIKE (ignore insert errors; we'll compute authoritative count next)
                const { error: insertErr } = await _supabase.from('likes').insert([{ video_id: id, user_email: currentUserEmail }]);
                if (insertErr) console.error('Insert like error:', insertErr);
            }

            // Compute authoritative like count from likes table
            let likesCount = 0;
            try {
                const { data: likesData, count } = await _supabase.from('likes').select('*', { count: 'exact' }).eq('video_id', id);
                if (typeof count === 'number') likesCount = count; else likesCount = (likesData && likesData.length) ? likesData.length : 0;
            } catch (cntErr) {
                console.error('Count likes error:', cntErr);
            }

            // Update UI with authoritative count
            if (hCountEl) hCountEl.innerText = likesCount;
            if (sideCountEl) sideCountEl.innerText = likesCount;

            // Update like button states based on whether current user still has a like
            try {
                const { data: nowLiked } = await _supabase.from('likes').select('*').eq('video_id', id).eq('user_email', currentUserEmail);
                const liked = nowLiked && nowLiked.length > 0;
                document.querySelectorAll(`.like-btn[data-id=\"${id}\"]`).forEach(b => { if(liked) { b.classList.add('liked'); b.dataset.liked = 'true'; } else { b.classList.remove('liked'); b.dataset.liked = 'false'; } });
                document.querySelectorAll(`.side-actions .like-side[data-id=\"${id}\"]`).forEach(b => { if(liked) b.classList.add('liked'); else b.classList.remove('liked'); });
            } catch (stateErr) {
                console.error('Like state update error:', stateErr);
            }

            // Persist authoritative count to videos table
            try {
                const { error: updateErr } = await _supabase.from('videos').update({ likes: likesCount }).eq('id', id);
                if (updateErr) console.error('Update video likes error:', updateErr);
            } catch (updErr) {
                console.error('Persist likes error:', updErr);
            }
        } catch (err) {
            console.error('Like error:', err);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    }

    async function checkUserLike(videoId) {
        if(isGuest) return;
        const { data } = await _supabase.from('likes').select('*').eq('video_id', videoId).eq('user_email', currentUserEmail);
        
        if(data && data.length > 0) {
            // Mark both horizontal and side like buttons
            document.querySelectorAll(`.like-btn[data-id="${videoId}"]`).forEach(b => {
                b.classList.add('liked');
                b.dataset.liked = 'true';
            });
            document.querySelectorAll(`.side-actions .like-side[data-id="${videoId}"]`).forEach(b => {
                b.classList.add('liked');
            });
        }
    }

    async function loadCommentsCount(videoId) {
        const { data } = await _supabase.from('comments').select('*').eq('video_id', videoId);
        const commentCount = data ? data.length : 0;
        
        // Update all comment count elements for this video
        document.querySelectorAll(`.comment-count[data-id="${videoId}"]`).forEach(countSpan => {
            countSpan.innerText = commentCount;
        });
    }

    async function checkUserFollow(creatorEmail) {
        if(isGuest || currentUserEmail === creatorEmail) return;
        
        // Check if user is following
        const { data } = await _supabase.from('follows').select('*').eq('follower_email', currentUserEmail).eq('following_email', creatorEmail);
        
        if(data && data.length > 0) {
            const followBtns = document.querySelectorAll(`.btn-follow[data-creator="${creatorEmail}"]`);
            followBtns.forEach(followBtn => {
                followBtn.classList.add('following');
                const textSpan = followBtn.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = 'Following';
                } else {
                    followBtn.innerText = 'Following';
                }
            });
        }
        
        // Get follower count
        const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', creatorEmail);
        const followerCount = followers ? followers.length : 0;
        
        // Update all follower count displays for this creator
        document.querySelectorAll(`.follower-count[data-creator="${creatorEmail}"]`).forEach(el => {
            el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
        });
    }

    function handleShare(url, btn) {
        const desc = btn.dataset.desc;
        if (navigator.share) {
            navigator.share({ title: 'Helostar', text: desc, url: url });
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    }

    // Direct share helper for side button (no DOM button available)
    function handleShareDirect(url, desc) {
        if (navigator.share) {
            navigator.share({ title: 'Helostar', text: desc || 'Check this out', url: url });
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
                comment_text: commentText,
                user_email: currentUserEmail
            }]);
            
            if(error) throw error;
            
            await new Promise(r => setTimeout(r, 300));
            await loadComments(id);
            await loadCommentsCount(id);
            
            // Auto-hide comments panel after successful post
            const panel = document.getElementById(`comm-panel-${id}`);
            if(panel) {
                setTimeout(() => {
                    panel.style.display = 'none';
                }, 800);
            }
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
        const video = vWrap.querySelector('video');
        
        if(!isFullscreen) {
            // Enter fullscreen
            vWrap.classList.add('fullscreen-short');
            card.classList.add('fullscreen-active');
            
            // Position and style action row
            actionRow.style.position = 'fixed';
            actionRow.style.bottom = '60px';
            actionRow.style.left = '15px';
            actionRow.style.right = '15px';
            actionRow.style.zIndex = '1000';
            actionRow.style.background = 'transparent';
            actionRow.style.width = 'auto';
            actionRow.style.display = 'flex';
            
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
            
            // Enable smooth scrolling while in fullscreen
            document.body.style.overflow = 'scroll';
            document.body.style.overscrollBehavior = 'contain';
            
            // Play video
            if(video && video.paused) {
                video.play().catch(() => {});
            }
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
            actionRow.style.display = 'flex';
            
            // Reset button styles
            actionRow.querySelectorAll('.btn-act').forEach(btn => {
                btn.style.background = '';
                btn.style.border = '';
            });
            
            // Show all cards and UI
            document.querySelectorAll('.card').forEach(c => c.style.display = 'block');
            document.querySelector('header').style.display = 'block';
            document.querySelector('.nav-tabs').style.display = 'flex';
            
            // Restore scroll behavior
            document.body.style.overflow = 'auto';
            document.body.style.overscrollBehavior = 'auto';
        }
    }
    
    // --- VIDEO MENU ---
    function toggleVideoMenu(event, videoId) {
        event.stopPropagation();
        // Close all other menus
        document.querySelectorAll('.video-menu-dropdown').forEach(m => {
            if(m.id !== `menu-${videoId}`) m.style.display = 'none';
        });
        // Toggle this menu
        const menu = document.getElementById(`menu-${videoId}`);
        if(menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
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
        
        // Close video menus when clicking elsewhere
        if (!event.target.closest('.video-menu-wrapper')) {
            document.querySelectorAll('.video-menu-dropdown').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    }

    async function toggleFollow(targetEmail, btn) {
    if (isGuest) {
        alert("Login to follow creators!");
        return;
    }
    if (targetEmail === currentUserEmail) {
        alert("You cannot follow yourself!");
        return;
    }

    // Prevent double clicks
    btn.disabled = true;
    btn.style.opacity = '0.6';
    
    try {
        const isFollowing = btn.classList.contains('following');
        
        if (isFollowing) {
            // Unfollow Logic
            const { error } = await _supabase.from('follows')
                .delete()
                .eq('follower_email', currentUserEmail)
                .eq('following_email', targetEmail);
            
            if (error) {
                // RLS policy error - try to show helpful message
                if(error.message.includes('row-level security') || error.message.includes('RLS')) {
                    console.warn('RLS policy active on follows table. Ensure policies allow DELETE for authenticated users.');
                    alert("Unable to unfollow at this moment. Please try again.");
                    return;
                }
                throw error;
            }
            
            // Update UI for all cards belonging to this creator
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.remove('following');
                const textSpan = b.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = "Follow";
                } else {
                    b.innerText = "Follow";
                }
            });
            
            // Update follower count
            try {
                const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', targetEmail);
                const followerCount = followers ? followers.length : 0;
                document.querySelectorAll(`.follower-count[data-creator="${targetEmail}"]`).forEach(el => {
                    el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
                });
            } catch(e) {
                console.warn('Could not fetch updated follower count');
            }
        } else {
            // Follow Logic
            const { error } = await _supabase.from('follows')
                .insert([{ follower_email: currentUserEmail, following_email: targetEmail }]);
            
            if (error) {
                // RLS policy error - provide helpful feedback
                if(error.message.includes('row-level security') || error.message.includes('RLS') || error.message.includes('policy')) {
                    console.warn('RLS policy error on follows table INSERT. Admin needs to configure RLS policies.');
                    console.warn('Error details:', error);
                    alert("Follow feature is temporarily unavailable. Please contact support.");
                    return;
                }
                throw error;
            }
            
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.add('following');
                const textSpan = b.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = "Following";
                } else {
                    b.innerText = "Following";
                }
            });
            
            // Update follower count
            try {
                const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', targetEmail);
                const followerCount = followers ? followers.length : 0;
                document.querySelectorAll(`.follower-count[data-creator="${targetEmail}"]`).forEach(el => {
                    el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
                });
            } catch(e) {
                console.warn('Could not fetch updated follower count');
            }
        }
    } catch(err) {
        console.error('Toggle follow error:', err);
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// ========== AUDIO REUSE FEATURE (Instagram-style) ==========
// Get list of audios from videos (grouped by unique audio tracks)
async function getAvailableAudios() {
    try {
        const { data, error } = await _supabase
            .from('videos')
            .select('id, url, description, owner')
            .not('audio_url', 'is', null)
            .limit(50);
        
        if(error) {
            console.log('Audio fetch (expected if no audio_url column):', error.message);
            return [];
        }
        return data || [];
    } catch(e) {
        // audio_url column may not exist yet - this is expected
        console.log('Audio reuse feature requires audio_url column in videos table');
        return [];
    }
}

// Display audio selector dialog
async function showAudioSelector() {
    const audios = await getAvailableAudios();
    if(audios.length === 0) {
        alert('No audios available yet. Upload videos to create reusable audios.');
        return null;
    }
    
    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    audios.forEach(audio => {
        html += `<div style="padding:10px; border-bottom:1px solid #333; cursor:pointer;" onclick="selectAudio('${audio.id}', '${audio.audio_url || audio.url}')">
            <div><b>@${audio.owner.split('@')[0]}</b></div>
            <div style="font-size:0.8rem; color:#999;">${audio.description}</div>
        </div>`;
    });
    html += '</div>';
    document.getElementById('audioSelector')?.remove();
    const div = document.createElement('div');
    div.id = 'audioSelector';
    div.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1a1a1a; padding:20px; border-radius:10px; z-index:10000; max-width:300px;';
    div.innerHTML = html;
    document.body.appendChild(div);
}

// Called when user selects an audio
function selectAudio(audioId, audioUrl) {
    window.selectedAudioUrl = audioUrl;
    window.selectedAudioId = audioId;
    document.getElementById('audioSelector')?.remove();
    alert('Audio selected! Now upload your video.');
}

// ========== END AUDIO REUSE FEATURE ==========

// Triggered when user clicks the upload button
async function handleUpload() {
    if(isGuest) return alert("Please login to upload!");
    
    const videoIn = document.getElementById('fileIn');
    videoIn.onchange = async (e) => {
        const videoFile = e.target.files[0];
        
        // Create an image input on the fly for the thumbnail
        const thumbIn = document.createElement('input');
        thumbIn.type = 'file'; thumbIn.accept = 'image/*';
        alert("Video selected! Now please select a thumbnail image (Cover).");
        
        thumbIn.onchange = async (te) => {
            const thumbFile = te.target.files[0];
            const desc = prompt("Enter video description:");
            
            const vName = `vid_${Date.now()}`;
            const tName = `thumb_${Date.now()}`;

            // Upload Video
            await _supabase.storage.from('videos').upload(vName, videoFile);
            const vUrl = _supabase.storage.from('videos').getPublicUrl(vName).data.publicUrl;

            // Upload Thumbnail
            await _supabase.storage.from('thumbnails').upload(tName, thumbFile);
            const tUrl = _supabase.storage.from('thumbnails').getPublicUrl(tName).data.publicUrl;

            // Save to DB
            await _supabase.from('videos').insert([{
                url: vUrl,
                thumbnail_url: tUrl,
                description: desc,
                owner: currentUserEmail,
                category: currentCat
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
    fileIn.type = 'file'; 
    fileIn.accept = 'image/*';
    
    fileIn.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            if(!file) return;

            // Generate a unique path for this user
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${currentUserEmail.replace(/[@.]/g, '_')}.${fileExt}`;

            // 1. Upload to Storage (use upsert: true to overwrite old file)
            const { error: uploadErr } = await _supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if(uploadErr) throw uploadErr;

            // 2. Get Public URL + Timestamp (to force browser refresh)
            const { data: urlData } = _supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
            
            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

            // 3. Save to Database
            const { error: dbErr } = await _supabase
                .from('profiles')
                .upsert({ 
                    email: currentUserEmail, 
                    avatar_url: publicUrl,
                    updated_at: new Date()
                }, { onConflict: 'email' });

            if(dbErr) throw dbErr;

            // 4. Success! Update the UI
            alert("Profile Picture Updated! Everyone can see it now.");
            location.reload(); // Simplest way to ensure all avatars on page refresh

        } catch(err) {
            console.error('Update failed:', err);
            alert("Update failed: " + err.message);
        }
    };
    fileIn.click();
}

// Delete video function
async function deleteVideo(videoId, btn) {
    if(!confirm("Are you sure you want to delete this video permanently?")) return;
    
    try {
        // Close the menu first
        const menu = document.getElementById(`menu-${videoId}`);
        if(menu) menu.style.display = 'none';
        
        // Find the video record to get file names
        const { data: video } = await _supabase.from('videos').select('*').eq('id', videoId).single();
        
        // Delete video file from storage
        if(video && video.url) {
            const videoFileName = video.url.split('/').pop();
            await _supabase.storage.from('videos').remove([videoFileName]).catch(e => console.log('Video file already gone or error:', e));
        }
        
        // Delete thumbnail if exists
        if(video && video.thumbnail_url) {
            const thumbFileName = video.thumbnail_url.split('/').pop();
            await _supabase.storage.from('thumbnails').remove([thumbFileName]).catch(e => console.log('Thumbnail already gone or error:', e));
        }
        
        // Delete from database
        const { error } = await _supabase.from('videos').delete().eq('id', videoId);
        
        if(error) {
            alert("Error deleting video: " + error.message);
            return;
        }
        
        alert("Video deleted successfully!");
        // Find and remove card from DOM immediately
        const card = document.querySelector(`[data-video-id="${videoId}"]`);
        if(card) card.remove();
        
        // Then refresh feed
        setTimeout(() => renderFeed(), 500);
    } catch(err) {
        console.error('Delete Error:', err);
        alert("Error deleting video: " + err.message);
    }
}

// Edit description function
async function editDescription(videoId, btn) {
    const descSpan = document.getElementById(`desc-${videoId}`);
    const currentDesc = descSpan ? descSpan.innerText : '';
    
    const newDesc = prompt("Edit video description:", currentDesc);
    if(newDesc === null) return; // User cancelled
    if(newDesc === currentDesc) return alert("Description is the same!");
    
    try {
        const { error } = await _supabase.from('videos').update({ description: newDesc }).eq('id', videoId);
        
        if(error) {
            alert("Error updating description: " + error.message);
            return;
        }
        
        // Update the description on the page
        if(descSpan) {
            descSpan.innerText = newDesc;
        }
        
        alert("Description updated successfully!");
    } catch(err) {
        console.error('Edit Error:', err);
        alert("Error updating description: " + err.message);
    }
}

// Shorts feature functions - Instagram style
function showHeartAnimation(x, y) {
    const heart = document.createElement('div');
    heart.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        font-size: 60px;
        color: #8b0000;
        pointer-events: none;
        z-index: 10000;
        animation: heartPopUp 0.6s ease-out forwards;
        text-shadow: 0 0 10px rgba(139, 0, 0, 0.8);
    `;
    heart.innerHTML = '❤️';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 600);
}

function showReelsFeedback(type) {
    if (window.suppressReelsFeedback) return;
    const feedback = document.createElement('div');
    feedback.className = 'reels-feedback';
    
    if(type === 'mute') {
        feedback.innerHTML = '<i class="fas fa-volume-mute"></i>';
        feedback.style.left = '30px';
    } else if(type === 'unmute') {
        feedback.innerHTML = '<i class="fas fa-volume-up"></i>';
        feedback.style.left = '30px';
    } else if(type === 'like') {
        feedback.innerHTML = '<i class="fas fa-heart"></i>';
        feedback.style.right = '30px';
        feedback.style.left = 'auto';
    }
    
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 600);
}

function enterReelsFullscreen(card, vWrap, video) {
    // Add fullscreen class
    vWrap.classList.add('reels-fs');
    card.classList.add('reels-fs-card');
    
    // Hide UI elements
    const header = card.querySelector('.card-header');
    const actionRow = card.querySelector('.action-row');
    const sideActions = card.querySelector('.side-actions');
    let descElement = null;
    
    // Find description element
    const lastDiv = card.querySelector('div:last-child');
    if(lastDiv && lastDiv.textContent.includes('@')) {
        descElement = lastDiv;
    }
    
    if(header) header.style.display = 'none';
    if(actionRow) actionRow.style.display = 'none';
    if(sideActions) sideActions.style.display = 'none';
    
    // Hide page UI
    const pageHeader = document.querySelector('header');
    const navTabs = document.querySelector('.nav-tabs');
    const uploadBtn = document.getElementById('uploadBtn');
    if(pageHeader) pageHeader.style.display = 'none';
    if(navTabs) navTabs.style.display = 'none';
    if(uploadBtn) uploadBtn.style.display = 'none';
    
    // Apply fullscreen styles to v-wrap
    vWrap.style.position = 'fixed';
    vWrap.style.top = '0';
    vWrap.style.left = '0';
    vWrap.style.width = '100vw';
    vWrap.style.height = '100vh';
    vWrap.style.zIndex = '9999';
    vWrap.style.margin = '0';
    vWrap.style.padding = '0';

    // Video fill
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    
    // Show description transparently at bottom
    if(descElement) {
        descElement.style.display = 'block';
        descElement.style.position = 'fixed';
        descElement.style.bottom = '20px';
        descElement.style.left = '0';
        descElement.style.right = '0';
        descElement.style.zIndex = '10000';
        descElement.style.background = 'rgba(0, 0, 0, 0.5)';
        descElement.style.color = '#fff';
        descElement.style.padding = '15px 20px';
        descElement.style.fontSize = '0.9rem';
        descElement.style.backdropFilter = 'blur(10px)';
        descElement.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    }
    

    // Hide other cards so this short stays full until user presses back
    document.querySelectorAll('.card').forEach(c => { if(c !== card) c.style.display = 'none'; });

    // Prevent page scroll while in reels fullscreen
    document.body.style.overflow = 'hidden';

    // Add a back button overlay so user can exit fullscreen explicitly
    let backBtn = vWrap.querySelector('.reels-back-btn');
    if(!backBtn) {
        backBtn = document.createElement('button');
        backBtn.className = 'reels-back-btn';
        backBtn.style.cssText = 'position:fixed; top:18px; left:18px; z-index:10001; background:rgba(0,0,0,0.5); border:none; color:#fff; padding:8px 10px; border-radius:8px; cursor:pointer;';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
        backBtn.addEventListener('click', (ev) => { ev.stopPropagation(); exitReelsFullscreen(card, vWrap, video); });
        vWrap.appendChild(backBtn);
    }

    // Play
    video.play().catch(() => {});
}

function exitReelsFullscreen(card, vWrap, video) {
    // Remove fullscreen class
    vWrap.classList.remove('reels-fs');
    card.classList.remove('reels-fs-card');
    
    // Show UI elements
    const header = card.querySelector('.card-header');
    const actionRow = card.querySelector('.action-row');
    const sideActions = card.querySelector('.side-actions');
    let descElement = null;
    
    // Find description element
    const lastDiv = card.querySelector('div:last-child');
    if(lastDiv && lastDiv.textContent.includes('@')) {
        descElement = lastDiv;
    }
    
    if(header) header.style.display = 'flex';
    if(actionRow) actionRow.style.display = 'flex';
    if(sideActions) sideActions.style.display = 'block';
    if(descElement) {
        descElement.style.cssText = ''; // Reset all styles
    }
    
    // Show page UI
    const pageHeader = document.querySelector('header');
    const navTabs = document.querySelector('.nav-tabs');
    const uploadBtn = document.getElementById('uploadBtn');
    if(pageHeader) pageHeader.style.display = 'block';
    if(navTabs) navTabs.style.display = 'flex';
    if(uploadBtn) uploadBtn.style.display = 'flex';
    // Show all cards again
    document.querySelectorAll('.card').forEach(c => c.style.display = 'block');

    // Restore page scroll
    document.body.style.overflow = '';
    
    // Reset styles
    vWrap.style.position = '';
    vWrap.style.top = '';
    vWrap.style.left = '';
    vWrap.style.width = '';
    vWrap.style.height = '';
    vWrap.style.zIndex = '';
    vWrap.style.margin = '';
    vWrap.style.padding = '';
    
    // Reset video
    video.style.width = '';
    video.style.height = '';
    video.style.objectFit = '';
    
    // Restore scroll
    // body overflow unchanged to allow smooth swiping while in fullscreen mode
}

// Swap fullscreen from one card to another (used for swiping while in reels fullscreen)
function swapFullscreenToCard(fromCard, toCard) {
    if(!toCard || !fromCard) return;
    const fromVWrap = fromCard.querySelector('.v-wrap');
    const fromVid = fromCard.querySelector('video');
    const toVWrap = toCard.querySelector('.v-wrap');
    const toVid = toCard.querySelector('video');

    if (!toVWrap || !toVid) return;

    try {
        // Pause ALL videos and reset audio
        document.querySelectorAll('video').forEach(vid => {
            try {
                vid.play();
                vid.currentTime = 0;
                vid.muted = false;
            } catch (e) {}
        });

        // Clean up previous fullscreen
        if (fromVWrap) {
            fromVWrap.classList.remove('reels-fs');
            fromVWrap.style.cssText = '';
        }

        // Apply fullscreen to new card
        toVWrap.classList.add('reels-fs');
        toVWrap.style.position = 'fixed';
        toVWrap.style.top = '0';
        toVWrap.style.left = '0';
        toVWrap.style.width = '100vw';
        toVWrap.style.height = '100vh';
        toVWrap.style.zIndex = '9999';
        toVWrap.style.margin = '0';
        toVWrap.style.padding = '0';
        
        toVid.style.width = '100%';
        toVid.style.height = '100%';
        toVid.style.objectFit = 'cover';

        // Play with proper promise handling
        if (toVid.paused) {
            const playPromise = toVid.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log('Play failed, retrying...');
                    setTimeout(() => {
                        toVid.play().catch(e => console.log('Retry failed'));
                    }, 100);
                });
            }
        }
    } catch (e) {
        console.error('Swap error:', e);
    }
}

function reelsTapHandler(event, zone, videoId) {
    // This function is no longer used but kept for compatibility
}

function toggleVideoMute(video) {
    if(!video) return;
    video.muted = !video.muted;
}

function toggleFullscreenComments(card, videoId) {
    const commPanel = card.querySelector(`#comm-panel-${videoId}`);
    if(!commPanel) return;
    
    if(commPanel.style.display === 'none' || commPanel.style.display === '') {
        // Show comments overlay
        commPanel.style.position = 'fixed';
        commPanel.style.bottom = '0';
        commPanel.style.left = '0';
        commPanel.style.right = '0';
        commPanel.style.display = 'block';
        commPanel.style.backgroundColor = 'rgba(0,0,0,0.95)';
        commPanel.style.zIndex = '9999';
        commPanel.style.height = 'auto';
        commPanel.style.borderRadius = '20px 20px 0 0';
        
        // Pause video when showing comments
        const video = card.querySelector('video');
        if(video) video.play();
    } else {
        // Hide comments overlay
        commPanel.style.display = 'none';
        
        // Resume video
        const video = card.querySelector('video');
        if(video) video.play();
    }
}