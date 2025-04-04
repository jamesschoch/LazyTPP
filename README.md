
<img src="https://raw.githubusercontent.com/jamesschoch/LazyTPP/refs/heads/main/lazytpp.png" width="500">

# LazyTPP

LazyTPP is a browser extension that adds overlay buttons to TwitchPlaysPokémon, allowing users to place bets, play pinball, check their balance, input move commands, and access the [visualizer](https://tppvisualizer.web.app/) without typing in chat.

## Features
- Quick betting and pinball buttons for mouse only input
- Auto Pinball
	- *(As each new game of pinball starts, your currently selected pinball settings will be submitted to chat)*
- Autoupdating pokéyen, token and rank balances/values
- Move input buttons

## Installation
1. Download the repo as a ZIP folder
2. Unzip
3. Load the extension into your browser:
   - **Chrome:** Go to `chrome://extensions/`, enable Developer Mode, and load the unpacked extension folder.
	   - ⚠️ Unsure if Chrome currently works, entirely untested
   - **Firefox:** Go to `about:debugging`, click "This Firefox", and load the extension temporarily.
	   - ✔️ Tested and working in Firefox Developer Edition 137.0b10 (64-bit)

## Usage Info
- Toggle Auto Pinball by using the "⟳" button to the right.
	- Auto Pinball messages are sent when "The last pinball game achieved..." is detected in chat.
- The dot indicator shows up on the pinball button when the last pinball game has finished and you can play again. 
- Hold shift while clicking + or - to increase/decrease your betting/pinball amount at 10x

## Notes/Planned
- The permissions required to retrieve the Twitch API token currently require "email:read" permissions to access the currently logged in user's username because I haven't yet found a better way to do this

## Contributing
Contributions are welcome! Feel free to submit issues or pull requests.

## License
Shield: [![CC BY-NC 4.0][cc-by-nc-shield]][cc-by-nc]

This work is licensed under a
[Creative Commons Attribution-NonCommercial 4.0 International License][cc-by-nc].

[![CC BY-NC 4.0][cc-by-nc-image]][cc-by-nc]

[cc-by-nc]: https://creativecommons.org/licenses/by-nc/4.0/
[cc-by-nc-image]: https://licensebuttons.net/l/by-nc/4.0/88x31.png
[cc-by-nc-shield]: https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg

## Credits
Created by [cyberbyteNZ](https://github.com/jamesschoch).
