# Karaoke
(Couldn't come up with more unique name)

This is the repository for my diploma project. The main objective is to develop 
web based application that would display transcription of an audio file and mark
current position in real time - hence the name 'Karaoke'. There sould also be an easy to use interface
for fast edition of transcription.
The idea is do make an easy to embed HTML component that would communicate with backend. The widget would 
fetch audio file and transcription from the server.
The final goal is to develop an algorithm for server to automatically sync transcription with audio.

# Getting Started

Production version is available on [Heroku](https://gstefanic-karaoke.herokuapp.com/)

These instructions will get you a copy of the project up and running on your local machine for testing purposes.

## Prerequisites

You should have `git`, `node`, and `npm` already installed.

## Installing

1. clone repository
2. install dependencies
3. start server

```
git clone https://github.com/gstefanic/diploma.git
cd diploma
npm install
npm start
```

Visit [http://localhost:3000/](http://localhost:3000/).

## Installing widget from production server

1. Include script in your HTML file (eg. inside head).

```html
<script async src="https://gstefanic-karaoke.herokuapp.com/javascripts/karaoke.js"></script>
```

2. Create an element with id equal to `karaoke`

```html
<div id='karaoke'></div>
```

The script is going to look for the element with selector `#karaoke` (Yes, currently there is support
for only one Karaoke widget).

## Using the widget

The widget can be loaded with multiple arguments that are passed to the script via `data-` attributes. 
Currently supported attributes are the following.

- `data-audio`: URL of audio source (has to be used in combination with `data-lyrics`)
- `data-lyrics`: URL of transcription file (has to be used in combination with `data-audio`)
- `data-track-id`: ID of the track saved on the server (in the future it will only work valid `API KEY`)
- `data-speech-layout`: displays transcription as a paragraph (defaults to `false`)
- `data-editable`: whethet editing of timestamps is allowed (defaults to `true`)

Example:

```html
<div id='karaoke' data-speech-layout="true" data-editable="false"></div>
```

## Transcription Fromat

Transcription (imported via `data-lyrics` attribute) must be a JSON file containing an 
array of objects that each contain timestamps for each line.

The following key value pairs are mandatory:
- `text`: a segment of transcription
- `start`: positive real number that marks the start of current section (in seconds)
- `end`: positive real number that marks the end of current section (in seconds)

```javascript
[
    {
        text: "The snow glows white on the mountain tonight",
        start: 13,
        end: 17,
    },
]
```

## Supported Features

- Controling of the audio with familiar interface.
- Highlighting of current line.
- Double click on any line jumps to that part of the recording.
- Editing of timestamps:
  - Edit button is shown on hover of current line.
  - Timestamps are changed locally on submit.

## Feature Requests

- Improve editing interface:
  - Add support to change text.
  - Full editor mode where new entries can be added, all lines can be edited, and removed.
- Control the access with API keys that would allow different privileges (eg. editor, view-only, contributor).
- Improve interface for controling playback:
  - Volume and speed controls.
  - Time indicators.
- Compact view where only a few lines are shown at the same time.
- Improve support for "speech layout" (controlled via `data-speech-layout` attribute)
- Full "karaoke" support (harder to explain, but just more accurate indicating of position).
- ...


