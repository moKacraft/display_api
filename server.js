const express = require('express');
const server = express();
const https = require('https');

function getFromURL(hostname, path, response, loadMore) {
    const options = {
        hostname: hostname,
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    let body;
    const req = https.request(options, (res) => {
        res.on('data', (d) => {
            body += d;
        });
        res.on('end', () => {
            // remove undefined at start of string
            body = body.substring(9);
            body = JSON.parse(body);
            if (hostname === 'www.reddit.com') {
                body = parseRedditJson(body, loadMore);
            } else if (hostname === 'a.4cdn.org') {
                body = parse4chanJson(body, loadMore);
            }
            response.json({ message: body })
        });
    });
    req.end();
}

function parseRedditJson(object, loadMore) {
    var threads = [];
    //console.log(object);
    var map = new Map();
    var after = object.data.after;
    for (article in object.data.children) {
        var infos = object.data.children[article];
        var subreddit = infos.data.subreddit_name_prefixed;
        var name = infos.data.name;

        // Remove r/ at start of string
        var topicLinkHref = './display.html?website=reddit&sort=hot&subreddit=' + subreddit.substring(2);
        var topicLinkTextContent = subreddit;

        var directLinkHref = infos.data.url;
        var directLinkTextContent = infos.data.domain;

        var commentLinkHref = 'https://reddit.com' + infos.data.permalink;
        var commentLinkTextContent = '🗨️ ' + infos.data.num_comments;

        var thumbnailSrc = infos.data.thumbnail;

        if (thumbnailSrc === 'default' || thumbnailSrc === 'self' || thumbnailSrc === 'image' || thumbnailSrc === 'nsfw') {
            thumbnailSrc = '';
        }

        var title = infos.data.title;

        var element = getRedditElement(infos);

        threads.push({ name: name, topicLinkHref: topicLinkHref, topicLinkTextContent: topicLinkTextContent, directLinkHref: directLinkHref, directLinkTextContent: directLinkTextContent, commentLinkHref: commentLinkHref, commentLinkTextContent: commentLinkTextContent, title: title, thumbnailSrc: thumbnailSrc, element: element });
    }
    loadMore += after;
    return { loadMore: loadMore, after: after, children: threads };
}

function getRedditElement(infos) {
    var url = infos.data.url;
    let element = {
        'isImage': false,
        'isVideo': false,
        'isEmbed': false,
        'isLink': false,
        'href': ''
    };
    if (infos.data.is_video) {
        element.isVideo = true;
        element.href = infos.data.secure_media.reddit_video.fallback_url;
    } else if (url.includes(".webm") || url.includes(".gifv")) {
        var videoUrl = url.replace(".gifv", ".mp4");
        videoUrl = url.replace(".webm", ".mp4");
        element.isVideo = true;
        element.href = videoUrl;
    } else if (url.match(/\.(jpeg|jpg|gif|png)$/) != null) {
        element.isImage = true;
        element.href = url;
    } else if (!(Object.entries(infos.data.secure_media_embed).length === 0 && infos.data.secure_media_embed.constructor === Object)) {
        element.isEmbed = true;
        element.href = infos.data.secure_media_embed.content;
    } else if (url.includes("https://imgur.com/")) {
        var img = url.substring(0, 8) + 'i.' + url.substring(8) + '.jpg';
        element.isImage = true;
        element.href = img;
    } else if (url.includes("https://v.redd.it/")) {
        element.isVideo = true;
        element.href = url + '/DASH_720';
    } else {
        //console.log('not yet implemented: ' + infos.data.url);
        //console.log(infos);
    }
    return element;
}

function parse4chanJson(object, loadMore) {
    var threads = [];
    var after = '';
    for (var i = 0; i < object.length; i++) {
        for (var j = 0; j < object[i].threads.length; j++) {
            var element = object[i].threads[j];
            //console.log(element)
            var name = '';
            var topicLinkHref = "https://a.4cdn.org/g/thread/" + element.no + ".json";
            var topicLinkTextContent = "" + element.no;
            var directLinkHref = '';
            var directLinkTextContent = '';
            var commentLinkHref = '';
            var commentLinkTextContent = '';
            var thumbnailSrc = "https://i.4cdn.org/g/" + element.tim + "s.jpg";
            var title = element.com;

            threads.push({ name: name, topicLinkHref: topicLinkHref, topicLinkTextContent: topicLinkTextContent, directLinkHref: directLinkHref, directLinkTextContent: directLinkTextContent, commentLinkHref: commentLinkHref, commentLinkTextContent: commentLinkTextContent, title: title, thumbnailSrc: thumbnailSrc });
        }
    }
    return { loadMore: loadMore, after: after, children: threads };
}

server.get("/", (req, res) => {
    // Probabbly bad practice
    // Need to specify domain instead of *
    res.header("Access-Control-Allow-Origin", "https://mokacraft.github.io");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const website = req.query.website;
    let hostname;
    let path;
    let loadMore;
    switch (website) {
        case "4chan":
            hostname = 'a.4cdn.org';
            path = '/g/catalog.json';
            loadMore = '';
            break;
        case "reddit":
            const subreddit = req.query.subreddit;
            const sort = req.query.sort;
            const after = req.query.after;
            path = '/r/' + subreddit + '/' + sort + '/.json?limit=15';
            if (after === undefined) {
            } else {
                path += '&after=' + after;
            }
            loadMore = './display.html?website=reddit&subreddit=' + subreddit + '&sort=' + sort + '&after=';
            hostname = 'www.reddit.com';
            break;
        default:
            break;
    }
    getFromURL(hostname, path, res, loadMore);
});
server.listen(process.env.PORT || 4000, () => {
    //console.log(`Server listening at ${port}`);
});
