const fs = require('fs');
const path = require('path');
const http = require('http');
const {URL} = require('url');

const download = require('download');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;


// TODO JSDOM.fromURL有些情况下会一直处于pending状态不返回resolve/reject，导致永久挂起
// 准备考虑不使用JSDOM.fromURL，使用其它方法获取HTML文本，再使用JSDOM解析


function getAllImagePageLink(detailsPageURL) {

    // 防止URL带上页数的参数,以确保是详情页的第一页
    detailsPageURL = detailsPageURL.split('?')[0];

    let options = {};
    
    return JSDOM.fromURL(detailsPageURL, options).then(({window: {document}}) => {

        let pageNavigationLinks = document.querySelector('.gtb').querySelectorAll('a');

            pageNavigationLinks = Array.from(pageNavigationLinks).map(el => el.href);

            pageNavigationLinks = pageNavigationLinks.length === 1 ? 
                                  pageNavigationLinks : 
                                  pageNavigationLinks.slice(0, -1);     // 去除最后一个链接（下一页箭头的链接）

            pageNavigationLinks = pageNavigationLinks.map(link => {
                
                return JSDOM.fromURL(link, options).then(({window: {document}}) => {

                    let imagePageLinks = document.querySelectorAll('#gdt > .gdtm a');
                        imagePageLinks = Array.from(imagePageLinks).map(el => el.href);

                    return imagePageLinks;
                });
                
            });

        return Promise.all(pageNavigationLinks).then(results => {

            let imagePages = [];

            results.forEach(arr => imagePages.push(...arr));

            return imagePages;
        });
    });
}

function getImagePageInfo(imagePageURL) {

    let options = {};
    
    return JSDOM.fromURL(imagePageURL, options).then(({window: {document}}) => {
        let imageEl  = document.getElementById('img');
        let imageURL = imageEl.src;
        let nextURL  = imageEl.parentElement.href;

        let onfailReloadCode = /onclick=\"return nl\('(.*)'\)\"/.exec(document.getElementById('loadfail').outerHTML)[1];
        let reloadURL        = imagePageURL + (imagePageURL.indexOf('?') > -1 ? '&' : '?') + 'nl=' + onfailReloadCode;

        return {
            imageURL, nextURL, reloadURL
        };

    });
}

function downloadIamge(imagePageURL, saveDir, fileName) {
    
    return getImagePageInfo(imagePageURL).then(({imageURL, reloadURL}) => {
        
        return download(imageURL, saveDir, {retries: 0, filename: fileName}).catch(err => {
            
            // 每次重试URL长度会增加，当长度到128以上停止重试，抛出错误
            if(imagePageURL.length < 128) {
                
                console.log(err);

                // 模拟点击"Click here if the image fails loading"链接，重新尝试下载当前图片
                return downloadIamge(reloadURL, saveDir, fileName);

            } else {
                throw new Error(`${fileName} Download Failed.`);
            }
        });
    });
}

function downloadAll(detailsPageURL, saveDir) {

    async function autoDownlaod(links) {

        for(let e of links.entries()) {

            let index = e[0], link = e[1];

            await downloadIamge(link, saveDir, index + '.jpg');
        }
    }

    return getAllImagePageLink(detailsPageURL).then(links => {
        return autoDownlaod(links);
    });
}

function downloadDoujinshi(detailsPageURL, saveDir) {

    try {
        if(fs.existsSync(saveDir) === false) {
            fs.mkdirSync(saveDir);
        }
    } catch (err) {
        return Promise.reject(err);
    }

    return downloadAll(detailsPageURL, saveDir);
}

module.exports = {
    downloadDoujinshi
}