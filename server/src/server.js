const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const {readFileSync} = require('fs');

const app = express();
app.use(bodyParser.json());

const config = JSON.parse(
	readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
);

const authConfig = new Map();
console.log('hei');
config?.auth?.forEach(object => {
	authConfig.set(object.user, object.key);
});

const stats = new Map();

app.post('/sls/event', (req, res) => {
	/*
		{
			on_event: 'on_connect' | 'on_close',
			role_name: 'publisher',
			srt_url: 'input/live/pack',
			remote_ip: '172.17.0.1',
			remote_port: '57374'
		}
	*/
	console.log('event', req.body);
	const {query} = req;
	const {role_name, srt_url, remote_ip, remote_port} = query;
	const srtUrl = srt_url.split('/');
	const [, , streamName] = srtUrl;
	if(!streamName) {
		res.status(400).send('Invalid stream name');
		return;
	}
	// get streamKey from streamName in format ?srtauth=<streamkey>
	const params = new URLSearchParams(streamName);

	const streamer = streamName?.split('?')[0];
	const streamKey = params.get('srtauth');

	if (query.on_event === 'on_connect') {
		if (streamKey) {
			const auth = authConfig.get(streamer);
			if (auth === streamKey) {
				console.log(`${role_name} connected to ${streamer}`);
				res.sendStatus(200);
			} else {
				console.log(`${role_name} connected to ${streamer} with wrong key`);
				res.sendStatus(401);
			}
		}
	} else if (query.on_event === 'on_close') {
		console.log(`${role_name} disconnected from ${streamer}`);
		stats.delete(streamer);
		res.sendStatus(200);
	} else {
		console.log(`${role_name} connected to ${streamer} with wrong event`);
		res.sendStatus(401);
	}
});

app.post('/sls/stats', (req, res) => {
	/* [
		{
			port: '1935',
			role: 'publisher',
			pub_domain_app: 'input/live',
			stream_name: 'pack',
			url: 'input/live/pack',
			remote_ip: '172.17.0.1',
			remote_port: '58927',
			start_time: '2020-08-22 00:15:12',
			kbitrate: '4274'
		},
		...
	] */

	const {query} = req;
	const {role, pub_domain_app, stream_name, url, remote_ip, remote_port, start_time, kbitrate} = query;

	if (role === 'publisher') {
		console.log('stats', req.body);
		const streamKey = url.split('?')[0];
		const streamer = streamKey.split('/')[1];
		stats.set(streamer, {
			port,
			streamer,
			pub_domain_app,
			stream_name: stream_name,
			url,
			remote_ip,
			remote_port,
			start_time,
			kbitrate
		})
		console.log(`stats posted to ${streamer}`);
	}

	res.sendStatus(200);
});

app.get('/sls/stats', (req, res) => {
	// URL: /sls/stats?streamer=<streamer>&key=<key>
	const {query} = req;
	const {key} = query;
	const streamer = req.query.streamer;
	const auth = authConfig.get(streamer);
	if (auth === key && streamer) {
		const stream = stats.get(streamer);
		res.json(stream);
	} else {
		res.status(401);
		res.send('can\'t list stats without auth');
	}
});

app.listen(3000, () => console.log('Server started'))
