document.addEventListener("DOMContentLoaded", function() {
    let currentIndex = 0;
    let posts = [];

    function search() {
        let query = $('#query').val().trim();
        if (query === '') {
            alert('Please enter a search term.');
            return;
        }
        let sort_by = $('#sort_by').val();
        let time_filter = $('#time_filter').val();
        let include_nsfw = $('#include_nsfw').is(':checked');
        let include_images = $('#include_images').is(':checked');
        let include_videos = $('#include_videos').is(':checked');
        let include_galleries = $('#include_galleries').is(':checked');

        console.log(`Query: ${query}, Sort by: ${sort_by}, Time filter: ${time_filter}, Include NSFW: ${include_nsfw}, Include Images: ${include_images}, Include Videos: ${include_videos}, Include Galleries: ${include_galleries}`);

        $.post('/scrape', {
            query: query,
            sort_by: sort_by,
            time_filter: time_filter,
            include_nsfw: include_nsfw,
            include_images: include_images,
            include_videos: include_videos,
            include_galleries: include_galleries
        }, function(data) {
            console.log("Data received:", data);
            $('#results').empty();
            if (data.error) {
                $('#results').append(`<div class="error">${data.error}</div>`);
                return;
            }
            posts = data;
            currentIndex = 0;
            displayPost(currentIndex);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Error during AJAX request:", textStatus, errorThrown);
            $('#results').append(`<div class="error">Error: ${textStatus}</div>`);
        });
    }

    function displayPost(index) {
        $('#results').empty();
        let item = posts[index];
        let content;
        if (item.type === 'image') {
            content = `<img src="${item.url}" alt="${item.title}" class="media-element">`;
        } else if (item.type === 'video' || item.type === 'reddit_video' || item.url.endsWith('.mp4') || item.url.startsWith('blob:') || item.url.includes('v.redd.it')) {
            if (item.audio_url) {
                content = `
                    <video controls class="media-element">
                        <source src="${item.url}" type="video/mp4">
                        <source src="${item.audio_url}" type="audio/mp4">
                    </video>`;
            } else {
                content = `<video controls src="${item.url}" class="media-element"></video>`;
            }
        } else if (item.type === 'youtube') {
            const videoId = item.url.split('v=')[1]?.split('&')[0] || item.url.split('/')[3];
            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
            content = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="media-element"></iframe>`;
        } else if (item.type === 'vimeo') {
            const videoId = item.url.split('.com/')[1];
            const embedUrl = `https://player.vimeo.com/video/${videoId}`;
            content = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="media-element"></iframe>`;
        } else if (item.type === 'gfycat') {
            const embedUrl = item.url.replace('gfycat.com', 'gfycat.com/ifr');
            content = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="media-element"></iframe>`;
        } else if (item.type === 'gallery') {
            content = `
                <div class="gallery-container" data-current-index="0">
                    <div class="gallery">
                        ${item.images.map((image, index) => `
                            <img src="${image}" alt="${item.title}" class="media-element gallery-image">
                        `).join('')}
                    </div>
                    <button class="gallery-prev" onclick="moveGallery(this, -1)">&#10094;</button>
                    <button class="gallery-next" onclick="moveGallery(this, 1)">&#10095;</button>
                </div>
            `;
        } else if (item.type === 'link' && item.url.includes('reddit.com')) {
            
            content = `<blockquote class="reddit-card"><a href="${item.url}">${item.title}</a></blockquote>`;
        } else {
            content = `<a href="${item.url}" target="_blank">${item.title}</a>`;
        }
        if (item.nsfw) {
            $('#results').append(`<div class="nsfw-item">${content}</div>`);
        } else {
            $('#results').append(`<div class="item">${content}</div>`);
        }
        $('#results').find('.gallery-image').hide().first().show();
    }

    // Function to move gallery images
    window.moveGallery = function(button, direction) {
        const galleryContainer = button.closest('.gallery-container');
        const gallery = galleryContainer.querySelector('.gallery');
        const images = gallery.querySelectorAll('.gallery-image');
        let currentIndex = parseInt(galleryContainer.getAttribute('data-current-index') || '0', 10);

        currentIndex += direction;
        if (currentIndex < 0) {
            currentIndex = images.length - 1;
        } else if (currentIndex >= images.length) {
            currentIndex = 0;
        }

        images.forEach((img, index) => {
            img.style.display = index === currentIndex ? 'block' : 'none';
        });

        galleryContainer.setAttribute('data-current-index', currentIndex);
    }

    function navigatePosts(direction) {
        currentIndex += direction;
        if (currentIndex < 0) {
            currentIndex = posts.length - 1;
        } else if (currentIndex >= posts.length) {
            currentIndex = 0;
        }
        displayPost(currentIndex);
    }

    $(document).ready(function() {
        $('#search-form').on('submit', function(e) {
            e.preventDefault();
            search();
        });

        // Event listeners for navigation buttons
        $('#prevPostBtn').on('click', function() {
            navigatePosts(-1);
        });

        $('#nextPostBtn').on('click', function() {
            navigatePosts(1);
        });
    });
});
