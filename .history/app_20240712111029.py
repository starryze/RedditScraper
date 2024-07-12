from flask import Flask, render_template, request, jsonify
import praw
import prawcore
import logging
import requests
import time

app = Flask(__name__)

# Configure PRAW (Reddit API Wrapper)
reddit = praw.Reddit(
    client_id='HfJQjgUcOq31Vc-_SqyVSg',
    client_secret='EU3hwPfOzpLqxIbw0af8A1qLkZEOCQ',
    user_agent='my_reddit_scraper by /u/RHRoulette'
)

def get_content_type(url):
    try:
        response = requests.head(url, allow_redirects=True)
        content_type = response.headers.get('content-type')
        if content_type:
            if 'image' in content_type:
                return 'image'
            elif 'video' in content_type:
                return 'video'
        if 'youtube.com' in url or 'youtu.be' in url:
            return 'youtube'
        elif 'vimeo.com' in url:
            return 'vimeo'
        elif 'gfycat.com' in url:
            return 'gfycat'
        elif 'v.redd.it' in url:
            return 'reddit_video'
        elif 'reddit.com/gallery/' in url:
            return 'gallery'
        elif 'reddit.com' in url and 'comments' in url:
            return 'link'
        elif url.startswith('blob:'):
            return 'blob'
    except Exception as e:
        logging.error(f"Error determining content type: {e}")
    return 'link'

def resolve_video_url(post):
    try:
        media = post.media
        if media and 'reddit_video' in media:
            return media['reddit_video']['fallback_url']
    except Exception as e:
        logging.error(f"Error resolving video URL: {e}")
    return None

def get_gallery_images(post):
    images = []
    try:
        if hasattr(post, 'media_metadata'):
            for item in post.media_metadata.values():
                if item['e'] == 'Image':
                    images.append(item['s']['u'])
    except Exception as e:
        logging.error(f"Error getting gallery images: {e}")
    return images

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scrape', methods=['POST'])
def scrape():
    query = request.form['query'].strip()
    sort_by = request.form.get('sort_by', 'relevance')
    time_filter = request.form.get('time_filter', 'all')
    include_nsfw = request.form.get('include_nsfw') == 'true'

    subreddit_name = 'all'

    desired_results = 11
    max_attempts = 5

    results = []
    processed_urls = set()
    processed_ids = set()
    attempts = 0
    after = None  # Initialize after parameter

    try:
        while len(results) < desired_results and attempts < max_attempts:
            posts = reddit.subreddit(subreddit_name).search(
                query, sort=sort_by, time_filter=time_filter, limit=50,
                params={'include_over_18': include_nsfw, 'after': after}
            )

            new_results_found = False

            for post in posts:
                if post.id in processed_ids or post.url in processed_urls:
                    continue

                content_type = get_content_type(post.url)

                if content_type in ['image', 'video', 'reddit_video', 'gallery']:
                    if content_type == 'reddit_video':
                        url = resolve_video_url(post)
                        if url is None:
                            processed_ids.add(post.id)
                            continue
                        results.append({
                            'title': post.title,
                            'url': url,
                            'nsfw': post.over_18,
                            'type': content_type,
                        })
                    elif content_type == 'gallery':
                        images = get_gallery_images(post)
                        if not images:
                            processed_ids.add(post.id)
                            continue
                        results.append({
                            'title': post.title,
                            'url': post.url,
                            'nsfw': post.over_18,
                            'type': content_type,
                            'images': images
                        })
                    else:
                        url = post.url
                        results.append({
                            'title': post.title,
                            'url': url,
                            'nsfw': post.over_18,
                            'type': content_type
                        })

                    processed_ids.add(post.id)
                    processed_urls.add(post.url)
                    new_results_found = True

                if len(results) >= desired_results:
                    break

            if not new_results_found:
                attempts += 1
            else:
                attempts = 0

            after = posts.params.get('after') if hasattr(posts, 'params') else None

            if attempts < max_attempts:
                time.sleep(1)

    except prawcore.exceptions.ResponseException as e:
        logging.error(f"Error fetching posts: {e}")
        return jsonify({'error': str(e)}), 500

    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({'error': str(e)}), 500

    return jsonify(results[:desired_results])

if __name__ == '__main__':
    app.run(debug=True)
