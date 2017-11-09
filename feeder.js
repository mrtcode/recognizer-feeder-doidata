/*
 ***** BEGIN LICENSE BLOCK *****
 
 This file is part of the Zotero Data Server.
 
 Copyright © 2017 Center for History and New Media
 George Mason University, Fairfax, Virginia, USA
 http://zotero.org
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.
 
 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 
 ***** END LICENSE BLOCK *****
 */

const sqlite = require('sqlite');
const request = require('request');
const he = require('he');
const config = require('./config');

let indexed = 0;
let indexedTotal = 0;
let done = false;

function index(batch) {
	return new Promise(function (resolve, reject) {
		request({
			url: config.indexerURL,
			method: 'POST',
			json: batch,
			timeout: 0
		}, function (err, res) {
			if (err) return reject(err);
			resolve();
		});
	});
}

async function main() {
	console.time("total time");
	let db = await sqlite.open(process.argv[2], {Promise});
	
	let stmt = await db.prepare('SELECT * FROM doidata');
	
	let row;
	
	let batch = [];
	while (row = await stmt.get()) {
		let title = row.title;
		
		if(!title) continue;

		if(title.length<=30 && row.subtitle) {
			title += ':' + row.subtitle;
		}
		
		title = he.decode(title);
		title = title.replace(/<!\[CDATA\[/g, '');
		title = title.replace(/\]\]>/g, '');
		title = title.replace(/<(?:.|\n)*?>/gm, '');
		
		batch.push({
			title: row.title,
			authors: row.authors,
			doi: row.doi
		});
		
		if (batch.length === 1000) {
			await index(batch);
			indexed+=1000;
			batch = [];
		}
	}
	await index(batch);
	indexed+=batch.length;
	
	await db.close();
	console.timeEnd("total time");
	done = true;
}

setInterval(function () {
	indexedTotal += indexed;
	console.log('indexed total: ' + indexedTotal + ', indexed per second: ' + indexed);
	indexed = 0;
	if (done) {
		process.exit(0);
	}
}, 1000);

main();
