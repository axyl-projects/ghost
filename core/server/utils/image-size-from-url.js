// Supported formats of https://github.com/image-size/image-size:
// BMP, GIF, JPEG, PNG, PSD, TIFF, WebP, SVG
// ***
// Takes the url of the image and an optional timeout
// getImageSizeFromUrl returns an Object like this
// {
//     height: 50,
//     url: 'http://myblog.com/images/cat.jpg',
//     width: 50
// };
// if the dimensions can be fetched and rejects with error, if not.
// ***
// In case we get a locally stored image or a not complete url (like //www.gravatar.com/andsoon),
// we add the protocol to the incomplete one and use urlFor() to get the absolute URL.
// If the request fails or image-size is not able to read the file, we reject with error.

var sizeOf = require('image-size'),
    url = require('url'),
    Promise = require('bluebird'),
    got = require('got'),
    config = require('../config'),
    dimensions;

/**
 * @description read image dimensions from URL
 * @param {String} imagePath
 * @returns {Promise<Object>} imageObject or error
 */
module.exports.getImageSizeFromUrl = function getImageSizeFromUrl(imagePath) {
    var imageObject = {},
        requestOptions,
        timeout = config.times.getImageSizeTimeoutInMS || 10000;

    imageObject.url = imagePath;

    // check if we got an url without any protocol
    if (imagePath.indexOf('http') === -1) {
        // our gravatar urls start with '//' in that case add 'http:'
        if (imagePath.indexOf('//') === 0) {
            // it's a gravatar url
            imagePath = 'http:' + imagePath;
        } else {
            // get absolute url for image
            imagePath = config.urlFor('image', {image: imagePath}, true);
        }
    }

    imagePath = url.parse(imagePath);
    requestOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: timeout,
        encoding: null
    };

    return got(
        imagePath,
        requestOptions
    ).then(function (response) {
        try {
            // response.body contains the Buffer. Using the Buffer rather than an URL
            // requires to use sizeOf synchronously. See https://github.com/image-size/image-size#asynchronous
            dimensions = sizeOf(response.body);

            imageObject.width = dimensions.width;
            imageObject.height = dimensions.height;

            return Promise.resolve(imageObject);
        } catch (err) {
            err.context = imagePath.href;

            return Promise.reject(err);
        }
    }).catch(function (err) {
        err.context = err.url || imagePath.href || imagePath;

        if (err.statusCode === 404) {
            err.message = 'Image not found.';

            return Promise.reject(err);
        } else if (err.code === 'ETIMEDOUT') {
            err.message = 'Request timed out.';

            return Promise.reject(err);
        } else {
            err.message = 'Unknown Request error.';

            return Promise.reject(err);
        }
    });
};
