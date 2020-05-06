;(function(window, undefined) {
	'use strict';

	var DEBUG = false;

	if (window.KC) {
		return;
	}

	window.KC = true;

	var baseUrl = '';

	var script = document.currentScript;
	if (script && script.src) {
		const regex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)(:[0-9]+)?)/g;
		const found = script.src.match(regex);
		baseUrl = found ? found[0] : baseUrl;
		log('baseUrl:', baseUrl);
	}

	/* HELPERS */

	function log(...args) {
		if (DEBUG) {
			console.log(...args);
		}
	}

	function docReady(fn) {
		// see if DOM is already available
		if (document.readyState === "complete" || document.readyState === "interactive") {
			// call on next available tick
			setTimeout(fn, 1);
		} else {
			document.addEventListener("DOMContentLoaded", fn);
		}
	}
	
	function linkStylesheet(url) {
		var link = document.createElement("link");
		link.href = url;
		link.type = "text/css";
		link.rel = "stylesheet";
		link.media = "screen,print";
		document.getElementsByTagName("head")[0].appendChild(link);
	}

	function extend(defaults, options) {
		for (var name in options) {
			if (defaults.hasOwnProperty(name)) {
				defaults[name] = options[name];
			}
		}
		return defaults;
	}

	function create(el, attr) {
		var element = document.createElement(el);
		if (attr) {
			for (var name in attr) {
				if (element[name] !== undefined) {
					element[name] = attr[name];
				}
			}
		}
		return element;
	}

	function readJSON(path, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', path, true);
		xhr.responseType = 'blob';
		xhr.onload = function(e) { 
			if (this.status == 200) {
				var file = new File([this.response], 'temp');
				var fileReader = new FileReader();
				fileReader.addEventListener('load', function(e){
					let lines = fileReader.result;
					var newArr;
					try {
						newArr = JSON.parse(lines); 
					} catch (error) {}
					if (isFunction(callback)) {
						callback(newArr);
					}
				});
				fileReader.readAsText(file);
			}
		}
		xhr.send();
	}

	function isFunction(functionToCheck) {
		return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
	}

	var AudioPlayer = (function() {

		var aphtml = 
		'<div class="ap-inner">\
			<div class="ap-panel">\
				<div class="ap-controls">\
					<button class="ap-controls ap-toggle-btn">\
						<i class="material-icons md-dark ap--play">play_arrow</i>\
						<i class="material-icons md-dark ap--pause">pause</i>\
					</button>\
				</div>\
				<div class="ap--track">\
					<div class="ap-progress-container">\
						<div class="ap-progress">\
							<div class="ap-bar"></div>\
							<div class="ap-preload-bar"></div>\
						</div>\
					</div>\
				</div>\
			</div>\
		</div>';
				
		// <div class="ap-item ap--settings">\
		// 	<div class="ap-controls ap-volume-container">\
		// 		<button class="ap-controls ap-volume-btn">\
		// 			<i class="material-icons md-dark ap--volume-on">volume_up</i>\
		// 			<i class="material-icons md-dark ap--volume-off">volume_mute</i>\
		// 		</button>\
		// 		<div class="ap-volume">\
		// 			<div class="ap-volume-progress">\
		// 				<div class="ap-volume-bar"></div>\
		// 			</div>\
		// 		</div>\
		// 	</div>\
		// </div>\

		var player,
		audio,
		playBtn,
		progressBar,
		preloadBar,
		curTime,
		durTime,
		seeking = false,
		rightClick = false,
		apActive = false,
		playEnabled = true,
		index = 0,
		playlist,
		settings = {
			container: 'body',
			volume: 0.5,
			autoplay: false,
			playlist: [],
			callbacks: {
				onPlayed: function(data) { log('@onPlayed implementation error'); },
				onPaused: function(data) { log('@onPaused implementation error'); },
				onTimeUpdated: function(data) { log('@onTimeUpdated implementation error'); }
			}
		};

		function init(options) {
			log("@init", JSON.stringify(options))

			if (!('classList' in document.documentElement)) {
				return false;
			}

			player = create('div', {
				'className': 'ap',
				'id': 'ap',
				'innerHTML': aphtml
			});

			if (apActive || player === null) {
				return;
			}

			settings = extend(settings, options);
			document.querySelector(settings.container).insertBefore(player, null);

			// get player elements
			playBtn = player.querySelector('.ap-toggle-btn');
			progressBar = player.querySelector('.ap-bar');
    		preloadBar = player.querySelector('.ap-preload-bar');

			// register event listeners
			playBtn.addEventListener('click', playToggle, false);

			progressBar.parentNode.parentNode.addEventListener('mousedown', handlerBar, false);
    		progressBar.parentNode.parentNode.addEventListener('mousemove', seek, false);
    		document.documentElement.addEventListener('mouseup', seekingFalse, false);

			apActive = true;

			// check if there are no files
			playlist = settings.playlist;
			if (playlist.length === 0) {
				log('No audio in playlist');
				return;
			}

			// create audio object
			audio = new Audio();
			audio.volume = settings.volume;
			setAudioSource()

			audio.addEventListener('error', onError, false);
			audio.addEventListener('play', onPlayed, false);
			audio.addEventListener('pause', onPaused, false);
			audio.addEventListener('timeupdate', onTimeUpdated, false);
			audio.addEventListener('ended', onEnded, false);

			if (settings.autoplay) {
				playToggle();
			}
		}

		function destroy() {
			log("@destroy");
			playBtn.removeEventListener('click', playToggle, false);

			progressBar.parentNode.parentNode.removeEventListener('mousedown', handlerBar, false);
			progressBar.parentNode.parentNode.removeEventListener('mousemove', seek, false);
			document.documentElement.removeEventListener('mouseup', seekingFalse, false);

			audio.removeEventListener('error', error, false);
			audio.removeEventListener('timeupdate', update, false);
			audio.removeEventListener('ended', doEnd, false);
			player.parentNode.removeChild(player);
		}

		function isPaused() { return audio.paused; }

		function isPlaylistEmpty() { return playlist.length === 0; }

		function playToggle() {
			log('@playToggle');
			if (isPlaylistEmpty()) {
				return;
			}
			if (isPaused()) {
				play();
			} else {
				pause();
			}
		}

		function setAudioSource() {
			audio.src = playlist[index].file;
			audio.preload = 'auto';
		}

		function goto(time) {
			log('@goto');
			if (time < 0) {
				time = 0;
			} else if (time > audio.duration) {
				time = audio.duration;
			}

			audio.currentTime = time;
		}

		function enablePlaying() {
			playEnabled = true;
			playBtn.disabled = false;
		}

		function disablePlaying() {
			playEnabled = false;
			pause();
			playBtn.disabled = true;
		}

		function play() {
			log('@play');
			if (!playEnabled) {
				return false;
			}
			index = (index > playlist.length - 1) ? 0 : index;
			if (index < 0) index = playlist.length - 1;
			
			if (isPlaylistEmpty()) {
				log('Playlist is empty');
				return false;
			}

			audio.play();
			return true;
		}
		
		function pause() {
			log('@pause');
			audio.pause();
			return true;
		}

		function prev() {
			log('@prev');
			index = index - 1;
			setAudioSource()
			play();
		}
		
		function next() {
			log('@next');
			index = index + 1;
			setAudioSource()
			play();
		}

		/* event handlers */
		function onPlayed() {
			log('onPlayed');
			updatePlayButtonUI();
			if (isFunction(settings.callbacks.onPlayed)) {
				settings.callbacks.onPlayed({});
			}
		}

		function onPaused() {
			log('onPaused');
			updatePlayButtonUI();
			if (isFunction(settings.callbacks.onPaused)) {
				settings.callbacks.onPaused({});
			}
		}

		function onEnded() {
			log('@onEnded');
			next();
		}

		function onTimeUpdated() {
			log('@onTimeUpdated');

			if (audio.readyState === 0) return;

			// Update Progress Bar
			var barlength = Math.round(audio.currentTime * (100 / audio.duration));
			progressBar.style.width = barlength + '%';
			
			// Update Preload Bar
			var buffered = audio.buffered;
			if(buffered.length) {
				var loaded = Math.round(100 * buffered.end(0) / audio.duration);
				preloadBar.style.width = loaded + '%';
			}

			if (isFunction(settings.callbacks.onTimeUpdated)) {
				settings.callbacks.onTimeUpdated(audio.currentTime)
			}
		}

		function onError() {
			log('@onError');
		}

		/* Progress Bar */
		function moveBar(evt, el, dir) {
			log("ELEMENT:", el.offsetLeft)
			var value;
			if (dir === 'horizontal') {
				value = Math.round( ((evt.offsetX - el.offsetLeft)) * 100 / el.parentNode.offsetWidth );
				el.style.width = value + '%';
				log('moveBar', value);
				return value;
			} else {
				var offset = (el.offset().top + el.offsetHeight) - window.pageYOffset;
				value = Math.round((offset - evt.clientY));
				if (value > 100) value = 100;
				if (value < 0) value = 0;
				volumeBar.style.height = value + '%';
				log('moveBar', value);
				return value;
			}
		}

		function seek(evt) {
			if (seeking && rightClick === false && audio.readyState !== 0) {
				var value = moveBar(evt, progressBar, 'horizontal');
				audio.currentTime = audio.duration * (value / 100);
			}
		}

		function handlerBar(evt) {
			rightClick = (evt.which === 3) ? true : false;
			seeking = true;
			seek(evt);
		}

		function seekingFalse() {
			seeking = false;
		}

		/* UI */
		function updatePlayButtonUI() {
			if (isPaused()) {
				playBtn.classList.remove('playing');
			} else {
				playBtn.classList.add('playing');
			}
		}

		/* Getters & Setters */
		function getDuration() {
			if (apActive) {
				return audio.duration;
			}
			return 0;
		}

		return {
			init: init,
			destroy: destroy,
			goto: goto,
			getDuration: getDuration,
			play: play,
			pause: pause,
			enablePlaying: enablePlaying,
			disablePlaying: disablePlaying
		};

	})();

	var LyricsComponent = (function() {

		var html =
		'<div class="lc-inner">\
			<div class="lc-panel">\
				<div class="lc-container">\
				</div>\
			</div>\
		</div>';
		// <span class="lc-past-line">hello world, how are you</span>\
		// <span class="lc-previous-line">previous</span>\
		// <span class="lc-current-line">current</span>\
		// <span class="lc-next-line">next</span>\
		// <span class="lc-upcoming-line">hello world, how are you</span>\
				
		var component,
		lyricsContainer,
		lyricsData,
		currentLineIndex = -1,
		prevTime,
		lcActive = false,
		syncEditing = false,
		isSetByGoto = false,
		lyrics,
		settings = {
			container: 'body',
			file: undefined,
			speechLayout: false,
			editable: true,
			callbacks: {}
		};

		function init(options, callback) {
			log('@init', JSON.stringify(options))

			if (!('classList' in document.documentElement)) {
				return false;
			}

			component = create('div', {
				'className': 'lc',
				'id': 'lc',
				'innerHTML': html
			});

			if (lcActive || component === null) {
				return false;
			}

			settings = extend(settings, options);
			document.querySelector(settings.container).insertBefore(component, null);

			// get elements
			lyricsContainer = component.querySelector('.lc-container');

			lyricsContainer.classList.add(settings.speechLayout ? 'lc-speech' : 'lc-song');
			
			if (!settings.file) {
				log('File path not specified!', JSON.stringify(settings))
				return false;
			}

			readJSON(settings.file, function(data) {
				log(data);
				if (data) {
					lyricsData = data;
					lyricsData.forEach(function(line, index) {
						lyricsContainer.appendChild(createLineContainer(index));
					});
					lcActive = true;
				}
				if (isFunction(callback)) {
					callback(lcActive);
				}
			});
		}

		function destroy() {
			log('@destroy');
			removeEditLineButtonHoverListeners();
			component.parentNode.removeChild(component);
		}

		function createLineControls() {
			var editBtnHtml = 
			'<button class="lc-edit-btn hide"><i class="material-icons md-dark md-18 lc--edit">edit</i></button>\
			<button class="lc-sync-done-btn hide"><i class="material-icons md-dark md-18 lc--sync-done">done</i></button>\
			<button class="lc-sync-cancel-btn hide"><i class="material-icons md-dark md-18 lc--sync-done">clear</i></button>'

			var div = document.createElement('div');
			div.classList.add('lc-line-controls');
			div.innerHTML = editBtnHtml.trim();
			return div;
		}

		function createLineText(line) {
			var container = create('div', {
				'className': 'lc-line lc-upcoming-line',
				'innerHTML': line.text
			});

			container.addEventListener('dblclick', onLineDoubleClicked, false);

			return container;
		}

		function createSyncControls(side, value) {
			var syncControlsHtml =
			'<button><i class="material-icons md-dark lc--sync-back hide">remove</i></button>\
			<input type="number" step="0.1" value="' + value + '" class="lc-sync-time">\
			<button><i class="material-icons md-dark lc--sync-forward hide">add</i></button>'

			return create('div', {
				'className': 'hide lc-sync-container lc-' + side + '-sync-container',
				'innerHTML': syncControlsHtml.trim()
			});
		}

		function createLineContainer(index) {
			var line = lyricsData[index];
			var container = create('div', {
				'id': 'line-' + index,
				'className': 'lc-line-container'
			});

			container.appendChild(createSyncControls('left', line.start));
			container.appendChild(createLineText(line));
			container.appendChild(createSyncControls('right', line.end));
			container.appendChild(createLineControls());
			
			return container;
		}

		function getCurrentLine() {
			return lyricsData[currentLineIndex];
		}

		function isCurrentLineIndexInBounds() {
			return currentLineIndex < lyricsData.length && currentLineIndex >= 0;
		}

		function addEditLineButtonHoverListeners() {
			var currentLineContainer = lyricsContainer.querySelector('#line-' + currentLineIndex);
			currentLineContainer.addEventListener('mouseover', onCurrentLineHover, false);
			currentLineContainer.addEventListener('mouseleave', onCurrentLineLeave, false);
		};

		function removeEditLineButtonHoverListeners() {
			var currentLineContainer = lyricsContainer.querySelector('#line-' + currentLineIndex);
			currentLineContainer.removeEventListener('mouseover', onCurrentLineHover, false);
			currentLineContainer.removeEventListener('mouseleave', onCurrentLineLeave, false);
		};

		function incCurrentLine() {
			log('@incCurrentLine', currentLineIndex);

			if (currentLineIndex < lyricsData.length) {
				if (currentLineIndex >= 0) {
					var currentLine = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line');
					currentLine.classList.remove('lc-active-line');
					currentLine.classList.remove('lc-current-line');
					currentLine.classList.add('lc-past-line');
					removeEditLineButtonHoverListeners();
					hideEditLineButton();
					hideSyncTools();
				}

				currentLineIndex += 1;

				if (currentLineIndex < lyricsData.length) {
					var currentLine = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line');
					currentLine.classList.remove('lc-upcoming-line');
					currentLine.classList.add('lc-current-line');
					addEditLineButtonHoverListeners();
					return true;
				}
			}
			return false;
		}

		function decCurrentLine() {
			log('@decCurrentLine', currentLineIndex);
			if (currentLineIndex >= 0) {
				if (currentLineIndex < lyricsData.length) {
					var currentLine = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line');
					currentLine.classList.remove('lc-active-line');
					currentLine.classList.remove('lc-current-line');
					currentLine.classList.add('lc-upcoming-line');
					removeEditLineButtonHoverListeners();
					hideEditLineButton();
					hideSyncTools();
				}

				currentLineIndex -= 1;

				if (currentLineIndex >= 0) {
					var currentLine = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line');
					currentLine.classList.remove('lc-past-line');
					currentLine.classList.add('lc-current-line');
					addEditLineButtonHoverListeners();
					return true;
				}
			}
			return false;
		}

		function showSyncTools() {
			log('@showSyncTools');
			syncEditing = true;

			var syncContainers = lyricsContainer.querySelectorAll('#line-' + currentLineIndex + ' .lc-sync-container');
			syncContainers.forEach(function(container) {
				container.classList.remove('hide');
			});

			var doneEditBtn = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-sync-done-btn');
			var cancelEditBtn = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-sync-cancel-btn');
			var leftTimeInput = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-left-sync-container input');
			var rightTimeInput = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-right-sync-container input');

			doneEditBtn.classList.remove('hide');
			cancelEditBtn.classList.remove('hide');

			doneEditBtn.addEventListener('click', onDoneEditClicked, false);
			cancelEditBtn.addEventListener('click', onCancelEditClicked, false);
			leftTimeInput.addEventListener('input', onLeftSyncTimeInput, false);
			rightTimeInput.addEventListener('input', onRightSyncTimeInput, false);
		}
		
		function hideSyncTools() {
			log('@hideSyncTools');
			syncEditing = false;

			var syncContainers = lyricsContainer.querySelectorAll('#line-' + currentLineIndex + ' .lc-sync-container');
			syncContainers.forEach(function(container) {
				container.classList.add('hide');
			});

			var doneEditBtn = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-sync-done-btn');
			var cancelEditBtn = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-sync-cancel-btn');
			var leftTimeInput = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-left-sync-container input');
			var rightTimeInput = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-right-sync-container input');

			doneEditBtn.classList.add('hide');
			cancelEditBtn.classList.add('hide');

			doneEditBtn.removeEventListener('click', onDoneEditClicked, false);
			cancelEditBtn.removeEventListener('click', onCancelEditClicked, false);
			leftTimeInput.removeEventListener('input', onLeftSyncTimeInput, false);
			rightTimeInput.removeEventListener('input', onRightSyncTimeInput, false);
		}

		function validateStartValue(value, index, returnValue = false) {
			log('@validateStartValue', value, index, returnValue);
			var endValue = lyricsContainer.querySelector('#line-' + index + ' .lc-right-sync-container input').value;
			if (value != lyricsData[index].start) {
				if (returnValue) {
					if (value < 0) return 0;
					if (index > 0 && value < lyricsData[index - 1].end) return lyricsData[index - 1].end;
					if (value > endValue) return endValue;
				} else {
					if (value < 0 || index > 0 && value < lyricsData[index - 1].end || value > endValue || isNaN(value)) {
						info('start time is invalid');
						return false;
					}
				}
			} else {
				info('start time is same as before');
			}
			return returnValue ? value : true;
		}

		function validateEndValue(value, index, returnValue = false) {
			log('@validateStartValue', value, index, returnValue);
			var startValue = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-left-sync-container input').value;
			if (value != lyricsData[index].end) {
				if (returnValue) {
					if (value > getDuration()) return getDuration();
					if (index < lyricsData.length - 1 && value > lyricsData[index + 1].start) return lyricsData[index + 1].start;
					if (value < startValue) return startValue;
				} else {
					if (value > getDuration() || index < lyricsData.length - 1 && value > lyricsData[index + 1].start || value < startValue || isNaN(value)) {
						info('end time is invalid');
						return false;
					}
				}
			} else {
				info('end time is same as before');
			}
			return returnValue ? value : true;
		}

		/* Event Handlers */

		function onLeftSyncTimeInput(event) {
			log('@onLeftSyncTimeInput');
			var value = validateStartValue(this.value, currentLineIndex, true);
			if (value !== this.value) {
				this.value = value;
			}
		}

		function onRightSyncTimeInput(event) {
			log('@onRightSyncTimeInput');
			var value = validateEndValue(this.value, currentLineIndex, true);
			if (value !== this.value) {
				this.value = value;
			}
		}

		function onLineDoubleClicked(event) {
			log('@onLineDoubleClicked');
			var lineIndex = this.parentNode.id.split('-')[1];
			if (isFunction(settings.callbacks.goto)) {
				isSetByGoto = true;
				settings.callbacks.goto(lyricsData[lineIndex].start);
			} else {
				error('goto not implemented');
			}
		}

		function onDoneEditClicked(event) {
			log('@onDoneEditClicked');
			hideSyncTools();
			showEditLineButton();

			// TODO: validate data
			var startValue = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-left-sync-container input').value;
			var endValue = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-right-sync-container input').value;

			var text = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line').textContent;

			log('startValue:', startValue, 'endValue:', endValue, 'text:', text);

			var dataIsValid = validateStartValue(startValue, currentLineIndex) && validateEndValue(endValue, currentLineIndex);
			
			if (text != lyricsData[currentLineIndex].text) {
				if (text.length === 0) {
					info('text is invalid');
					dataIsValid = false;
				}
			} else {
				info('text is same as before');
			}
			
			if (!dataIsValid) {
				// TODO: show error in UI
				return;
			}

			// TODO: update on the server
			var data = {
				index: currentLineIndex,
				text: text,
				start: startValue,
				end: endValue
			};

			var xhr = new XMLHttpRequest();
			xhr.open("PUT", baseUrl + '/api/v1/lyrics/' + 1 , true);
			xhr.setRequestHeader('Content-type','application/json;charset=utf-8');
			xhr.onload = function() {
				var res = JSON.parse(xhr.responseText);
				if (xhr.readyState == 4 && xhr.status == "200") {
					log(res);
					updateLyricsData(data);
				} else {
					error('error:', res);
					resetLyricsDataValue(currentLineIndex);
				}
				enablePlaying();
			}
			xhr.send(JSON.stringify(data));

		}

		function updateLyricsData(data) {
			log('@updateLyricsData', data);
			var line = lyricsData[data.index];
			line.end = data.end;
			line.start = data.start;
			line.text = data.text;
		}

		function resetLyricsDataValue(index) {
			lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-left-sync-container input').value = lyricsData[index].start;
			lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-right-sync-container input').value = lyricsData[index].end;
			lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line').innerHTML = lyricsData[index].text;
		}
		
		function onCancelEditClicked(event) {
			log('@onCancelEditClicked');
			hideSyncTools();
			showEditLineButton();
			enablePlaying();
		}

		function onEditLineClicked(event) {
			log('@onEditLineClicked');
			hideEditLineButton();
			showSyncTools();
			disablePlaying();
		}

		function onCurrentLineHover(event) {
			if (syncEditing) {
				return;
			}
			showEditLineButton();
		}

		function onCurrentLineLeave() {
			hideEditLineButton();
		}
		
		function showEditLineButton() {
			log('@showEditLineButton', currentLineIndex);
			if (!settings.editable) {
				return;
			}
			var editLineButton = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line-controls .lc-edit-btn');
			editLineButton.addEventListener('click', onEditLineClicked, false);
			editLineButton.classList.remove('hide');
		}

		function hideEditLineButton() {
			log('@hideEditLineButton', currentLineIndex);
			var editLineButton = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line-controls .lc-edit-btn');
			editLineButton.removeEventListener('click', onEditLineClicked, false);
			editLineButton.classList.add('hide');
		}

		function onTimeUpdated(currentTime) {
			log('@onTimeUpdated', currentTime, currentLineIndex, lyricsData);
			if (!lcActive) {
				return false;
			}

			if (prevTime === undefined) {
				incCurrentLine();
				prevTime = 0;
			}

			if (prevTime <= currentTime) {
				while((currentLineIndex < 0 || isCurrentLineIndexInBounds() && currentTime >= getCurrentLine().end) 
				&& incCurrentLine()) {}
			} else {
				while((currentLineIndex >= lyricsData.length || isCurrentLineIndexInBounds() && currentTime < getCurrentLine().start) 
				&& decCurrentLine()) {}
			}

			if (isCurrentLineIndexInBounds() && currentTime >= getCurrentLine().start && currentTime <= getCurrentLine().end) {
				var currentLine = lyricsContainer.querySelector('#line-' + currentLineIndex + ' .lc-line');
				currentLine.classList.add('lc-active-line');
				if (isSetByGoto) {
					isSetByGoto = false;
					showEditLineButton()
				}
			}

			prevTime = currentTime;
		}

		/* Getters */

		function getDuration() {
			if (isFunction(settings.callbacks.getDuration)) {
				var duration = settings.callbacks.getDuration();
				if (!!duration) {
					return duration;
				}
			}
			return Infinity;
		}

		/* Extern functions */

		function enablePlaying() {
			log('@enablePlaying');
			if (isFunction(settings.callbacks.enablePlaying)) {
				return settings.callbacks.enablePlaying();
			} else {
				error('implementation error @enablePlaying');
				return false;
			}
		}

		function disablePlaying() {
			log('@disablePlaying');
			if (isFunction(settings.callbacks.disablePlaying)) {
				return settings.callbacks.disablePlaying();
			} else {
				error('implementation error @disablePlaying');
				return false;
			}
		}

		return {
			init: init,
			destroy: destroy,
			onTimeUpdated: onTimeUpdated
		}

	})();

	var KaraokeComponent = (function() {

		var html = 
		'<div id="player"></div>\
		<div id="lyrics"></div>';

		var component,
		kcActive = false,
		settings = {
			container: undefined,
			callbacks: {}
		};

		function init(options) {
			log("@init", JSON.stringify(options))

			if (!('classList' in document.documentElement)) {
				log('!classList');
				return false;
			}

			if (kcActive) {
				log("RETURN kcActive", kcActive);
				return false;
			}

			settings = extend(settings, options);
			var component = document.querySelector(settings.container);
			if (!component) {
				log("RETURN !component");
				return false;
			}
			component.innerHTML = html;

			// read data-
			var data = component.dataset;
			log('data:', data, data.speechLayout === "true");

			var opts = {
				speechLayout: data.speechLayout == "true",
				editable: data.editable == "false"
			};

			if (data.audio && data.lyrics) {
				loadTrack({
					src: data.audio,
					lyrics: data.lyrics,
					speechLayout: data.speechLayout === "true"
				});
			} else if (data.trackId) {
				getSingleTrack(data.trackId, function(status, track) {
					log("status:", status, "track:", track);
					if (status === 200) {
						kcActive = loadTrack(track, opts);
					}
				})
			} else {
				getAllTracks(function(status, tracks) {
					log("status:", status, "tracks:", tracks);
					if (status === 200) {
						kcActive = loadTrack(tracks[0], opts);
					}
				});
			}

		}

		function destroy() {
			component.parentNode.removeChild(component);
		}

		function getAllTracks(callback) {
			log('@getAllTracks')
			var xhr = new XMLHttpRequest();
			xhr.open("GET", baseUrl + '/api/v1/tracks', true);
			xhr.onload = function() {
				var res = JSON.parse(xhr.responseText);
				if (xhr.readyState == 4) {
					callback(xhr.status, res);
				} else {
					error('error:', res);
				}
			}
			xhr.send(null);
		}

		function getSingleTrack(id, callback) {
			log('@getSingleTrack', id);
			var xhr = new XMLHttpRequest();
			xhr.open("GET", baseUrl + '/api/v1/tracks/' + id, true);
			xhr.onload = function() {
				log('xhr.responseText:', xhr.responseText)
				var res = JSON.parse(xhr.responseText);
				if (xhr.readyState == 4) {
					callback(xhr.status, res);
				} else {
					error('error:', res);
				}
			}
			xhr.send(null);
		}

		function loadTrack(track, options) {
			log('@loadTrack', track)
			if (!track) {
				return false;
			}

			AudioPlayer.init({
				container: '#player',
				autoplay: false,
				playlist: [
					{'title': track.title, 'file': baseUrl + track.src}
				],
				callbacks: {
					onTimeUpdated: LyricsComponent.onTimeUpdated
				}
			});

			LyricsComponent.init({
				container: '#lyrics',
				file: baseUrl + track.lyrics,
				speechLayout: options.speechLayout || track.speechLayout == "true",
				editable: options.editable === false,
				callbacks: {
					goto: AudioPlayer.goto,
					getDuration: AudioPlayer.getDuration,
					enablePlaying: AudioPlayer.enablePlaying,
					disablePlaying: AudioPlayer.disablePlaying
				}
			});
		}

		return {
			init: init,
			destroy: destroy
		}

	})();

	linkStylesheet('https://fonts.googleapis.com/icon?family=Material+Icons');
	linkStylesheet(baseUrl + '/stylesheets/karaoke.css');

	docReady(function() {
		KaraokeComponent.init({
			container: '#karaoke'
		})
	});

})(window);