/*--------------------------------

             LazyTPP
 
         Version v2.0.0b
       Made by cyberbyteNZ

--------------------------------*/



var clientId = '';
var twitchurl = "https://www.twitch.tv/twitchplayspokemon/";
var socket;
var accessToken;
var username;
var reconnectInterval;
var websocketUrl = 'wss://irc-ws.chat.twitch.tv';
var reconnectAttempts = 0;
var maxReconnectAttemps = 5;
var reconnectDelay = 5000;
var userId;
var betValue = 1000;
var betTeam = 'blue';
var balanceValue = 0;
var pinballValue = 1;
var autobet = false;
var autopinball = false;
var betOnOdds = false;
var move = {
  "symbol": "!",
  "1": "-",
  "2": "-",
  "3": "-",
  "4": "-"
}

var checkMutations = false;

var currenturl = window.location.href;


function updateBalance() {
  var pokeyen = fetch(`https://twitchplayspokemon.tv/api/username_to_id/${username}`)
    .then(response => response.json())
    .then(data => {
      return fetch('https://twitchplayspokemon.tv/api/users/' + data);
    })
    .then(response => response.json())
    .then(userData => {
      balanceValue = userData.pokeyen;
      userRank = userData.pokeyen_bet_rank;
      if (userRank === null) {
        userRank = "Unranked";
      } else {
        userRank = "R" + userRank;
      }
      userTokens = userData.tokens;
      document.querySelector('.tpp-value-balance-field').value = "₽" + balanceValue + " T" + userTokens + " " + userRank;
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function checkOdds() {
  var odds = fetch('https://twitchplayspokemon.tv/api/current_match')
    .then(response => response.json())
    .then(data => {
      return data.pokeyen_odds;
    })
  return odds;
}

if (currenturl.includes("access_token")) {
  var token = currenturl.split("=")[1].split("&")[0];
  chrome.storage.local.set({ accessToken: token });
}

function waitForElement(selector) {
  return new Promise((resolve) => {
    var checkExist = setInterval(() => {
      if (document.querySelector(selector)) {
        clearInterval(checkExist);
        resolve();
      }
    }, 100);
  });
}

var redirectToTwitchAuthorization = (clientId, redirectUri) => {
  var authorizationUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=user%3Amanage%3Awhispers+user%3Aread%3Aemail+chat:edit+chat:read`;
  window.location.href = authorizationUrl;
};

var getAccessToken = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['accessToken'], (result) => {
      accessToken = result.accessToken;
      resolve(accessToken);
    });
  });
};

var getUsername = async (accessToken) => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['username'], (result) => {
      if (result.username) {
        username = result.username;
        resolve(username);
      } else {
        fetchUsername(accessToken).then(username => resolve(username));
      }
    });
  });
};

var fetchUsername = async (accessToken) => {
  try {
    var response = await fetch("https://api.twitch.tv/helix/users", {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Authorization": "Bearer " + accessToken
      }
    });
    var json = await response.json();

    username = json.data[0].login;
    chrome.storage.local.set({ username: username });
    return username;
  } catch (err) {
    console.error("Error fetching username:", err);
    return null;
  }
};

function initializeWebSocket(websocketUrl, accessToken, username) {
  websocket = new WebSocket(websocketUrl);
  websocket.onopen = () => {
    websocket.send('CAP REQ :twitch.tv/commands twitch.tv/tags');
    websocket.send(`PASS oauth:${accessToken}`);
    websocket.send(`NICK ${username}`);
    websocket.send('JOIN #twitchplayspokemon');
  };

  websocket.onmessage = (event) => {

    if (event.data.indexOf("The last pinball game achieved") !== -1) {
      document.querySelector(".tpp-pinball-submit-button").classList.add("pinballready");
      setTimeout(() => {
        if (autopinball) {
          sendMessageToTwitchChat("!pinball t" + pinballValue);
          document.querySelector('.tpp-pinball-submit-button').classList.remove("pinballready");
        }
      }, 3000);
    } else if (event.data.indexOf("won the match!") !== -1) {
      updateBalance();
    } else if (event.data.indexOf("Sidegame inputting is now open") !== -1) {
      setTimeout(() => {
        // sendMessageToTwitchChat("a");
      }, 3000);
    } else if (event.data.indexOf("The match starts in 10 seconds") !== -1) {
      updateBalance();
      // `if (autobet) {
      //   setTimeout(() => {
      //     sendMessageToTwitchChat("!bet " + betValue + " " + betTeam);
      //   }, 3000);
      // }`
    }

    if (event.data.includes('PING')) {
      websocket.send('PONG :tmi.twitch.tv');
    }
  };

  websocket.onclose = (event) => {
    // handleReconnect(websocketUrl, accessToken, username);
    // console.log('WebSocket closed:', event);
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

async function getUserId(myUsername, accessToken) {
  var response = await fetch(`https://api.twitch.tv/helix/users?login=${myUsername}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    }
  });

  var data = await response.json();
  return data.data[0].id;

}

async function sendWhisper(targetUser, message) {

  userId = await getUserId(username, accessToken);
  var targetUserId = await getUserId(targetUser, accessToken);
  var whisperPayload = {
    target_user_id: userId,
    message: message
  };

  var response = await fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${userId}&to_user_id=${targetUserId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(whisperPayload)
  });

  if (response.ok) {
    console.log('Whisper sent successfully');
  } else {
    console.error('Failed to send whisper:', response.statusText);
  }
}

function sendMessageToTwitchChat(message) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    initializeWebSocket(websocketUrl, accessToken, username);
    return;
  }

  try {
    if (message.startsWith('/w ')) {
      user = message.split(' ')[1];
      message = message.split(' ').slice(2).join(' ');
      sendWhisper(user, message);

    } else {
      websocket.send(`PRIVMSG #twitchplayspokemon :${message}`);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

var template = `
<div class="tpp-buttons">
<details class="tpp-buttons-details" open="">
  <summary class="tpp-buttons-summary">Commands</summary>
  <div class="tpp-buttons-inner">
    <div class="tpp-buttons-row tpp-buttons-row-balance"><input type="text" readonly=""
        class="tpp-value-field tpp-value-balance-field"><button class="tpp-button tpp-balance-submit-button">Check
        Balance</button></div>
    <div class="tpp-buttons-row tpp-buttons-row-betting"><input type="number" min="0" value="1000" step="100"
        class="tpp-value-field"><button class="tpp-button tpp-value-up">+</button><button
        class="tpp-button tpp-value-down">-</button>
      <div class="tpp-buttons-row">
        <div class="tpp-radiogroup"><input type="radio" name="betTeam" value="blue"
            class="tpp-radio tpp-radio-blue"><label class="tpp-button">Blue</label></div>
        <div class="tpp-radiogroup"><input type="radio" name="betTeam" value="red"
            class="tpp-radio tpp-radio-red"><label class="tpp-button">Red</label></div>
      </div><button class="tpp-button tpp-bet-submit-button">Bet</button>
      <div class="tpp-checkbox-container"><!-- <input type="checkbox" name="autoBet" value="autoBet" id="autoBet"
          class="tpp-checkbox"><span class="tpp-checkmark"></span>!--></div>
    </div>
    <div class="tpp-buttons-row tpp-buttons-row-pinball"><input type="number" min="1" value="1" step="1"
        class="tpp-value-field tpp-value-pinball-field"><button
        class="tpp-button tpp-pinball-button tpp-pinball-value-up">+</button><button
        class="tpp-button tpp-pinball-button tpp-pinball-value-down">-</button><button
        class="tpp-button tpp-pinball-submit-button">!pinball</button>
      <div class="tpp-checkbox-container"><input type="checkbox" name="autoPinball" value="autoPinball"
          id="autoPinball" class="tpp-checkbox"><span class="tpp-checkmark"></span></div>
    </div>
    <div class="tpp-buttons-row tpp-buttons-row-controls">
      <div class="tpp-buttons-column">
        <div class="tpp-buttons-row">
          <div class="tpp-buttons-controls tpp-buttons-controls1">
            <div class="tpp-buttons-row">
              <div class="tpp-button-grid tpp-button-grid-controls">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="A" class="tpp-radio"><label
                    class="tpp-button">A</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="B" class="tpp-radio"><label
                    class="tpp-button">B</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="C" class="tpp-radio"><label
                    class="tpp-button">C</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="D" class="tpp-radio"><label
                    class="tpp-button">D</label>
                </div>
              </div>
              <div class="tpp-button-grid tpp-button-grid-target">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="U" class="tpp-radio"><label
                    class="tpp-button">U</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="L" class="tpp-radio"><label
                    class="tpp-button">L</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="S" class="tpp-radio"><label
                    class="tpp-button">S</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="P" class="tpp-radio"><label
                    class="tpp-button">P</label>
                </div>
              </div>
              <div class="tpp-button-grid tpp-button-grid-switch">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="1" class="tpp-radio"><label
                    class="tpp-button">1</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="2" class="tpp-radio"><label
                    class="tpp-button">2</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="3" class="tpp-radio"><label
                    class="tpp-button">3</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls1move" value="4" class="tpp-radio"><label
                    class="tpp-button">4</label>
                </div>
              </div>

            </div>
          </div>
          &nbsp;
          <div class="tpp-buttons-controls tpp-buttons-controls2">
            <div class="tpp-button-row">
              <div class="tpp-button-grid tpp-button-grid-controls">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="A" class="tpp-radio"><label
                    class="tpp-button">A</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="B" class="tpp-radio"><label
                    class="tpp-button">B</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="C" class="tpp-radio"><label
                    class="tpp-button">C</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="D" class="tpp-radio"><label
                    class="tpp-button">D</label>
                </div>
              </div>
              <div class="tpp-button-grid tpp-button-grid-target">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="U" class="tpp-radio"><label
                    class="tpp-button">U</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="L" class="tpp-radio"><label
                    class="tpp-button">L</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="S" class="tpp-radio"><label
                    class="tpp-button">S</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="P" class="tpp-radio"><label
                    class="tpp-button">P</label>
                </div>
              </div>
              <div class="tpp-button-grid tpp-button-grid-switch">
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="1" class="tpp-radio"><label
                    class="tpp-button">1</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="2" class="tpp-radio"><label
                    class="tpp-button">2</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="3" class="tpp-radio"><label
                    class="tpp-button">3</label>
                </div>
                <div class="tpp-radiogroup">
                  <input type="radio" name="controls2move" value="4" class="tpp-radio"><label
                    class="tpp-button">4</label>
                </div>
              </div>


            </div>
          </div>
        </div>
        <div class="tpp-buttons-row tpp-buttons-controls-buttons">
          <button class="tpp-button tpp-buttons-controls tpp-buttons-controls-clear">!-</button>
          <input type="text" readonly="" class="tpp-value-field tpp-value-controls-field">&nbsp;
          <button class="tpp-button tpp-buttons-controls tpp-buttons-controls-submit">Submit</button>
          &nbsp;<button class="tpp-button tpp-visualizer-link-button">Visualizer</button>
        </div>
      </div>
    </div>
  </div>
</details>
</div>
`;


var initialize = async () => {
  var storedAccessToken = await getAccessToken();

  if (!storedAccessToken) {
    redirectToTwitchAuthorization(clientId, twitchurl);
    return;
  }

  var retrievedUsername = await getUsername(storedAccessToken);

  if (!retrievedUsername) {
    console.error("Failed to retrieve username. Cannot connect to chat.");
    return;
  }

  initializeWebSocket(websocketUrl, storedAccessToken, username);
  waitForElement('.chat-input').then(() => {

    $(".chat-input").before(template);


    $('head').append('<style>' + css + '</style>');

    $('.tpp-balance-submit-button').click(function () {
      updateBalance();
    }
    );

    $('.tpp-bet-submit-button').click(function () {
      sendMessageToTwitchChat('!bet ' + betValue + " " + betTeam);
    }
    );

    $('.tpp-pinball-submit-button').click(function () {
      sendMessageToTwitchChat("!pinball t" + pinballValue);
      document.querySelector('.tpp-pinball-submit-button').classList.remove("pinballready");
    }
    );

    $('.tpp-buttons-controls-clear').click(function () {
      move["1"] = "-";
      move["2"] = "-";
      move["3"] = "-";
      move["4"] = "-";
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    }
    );

    $('.tpp-visualizer-link-button').click(function () {
      window.open("https://tppvisualizer.web.app");
    }
    );

    $('.tpp-value-up').click(function (event) {
      if (event.shiftKey) {
        betValue += 1000;
      } else {
        betValue += 100;
      }
      $('.tpp-buttons-row-betting .tpp-value-field').val(betValue);
    }
    );

    $('.tpp-value-down').click(function (event) {
      if (event.shiftKey) {
        betValue -= 1000;
      } else {
        betValue -= 100;
      }
      $('.tpp-buttons-row-betting .tpp-value-field').val(betValue);
    }
    );

    $('.tpp-pinball-value-up').click(function (event) {
      if (event.shiftKey) {
        pinballValue += 10;
      } else {
        pinballValue += 1;
      }
      $('.tpp-value-pinball-field').val(pinballValue);
    }
    );

    $('.tpp-pinball-value-down').click(function (event) {
      if (event.shiftKey) {
        pinballValue -= 10;
      } else {
        pinballValue -= 1;
      }
      $('.tpp-value-pinball-field').val(pinballValue);
    }
    );

    $('.tpp-radio-blue + label').click(function () {
      betTeam = 'blue';
      $('.tpp-radio').prop("checked", false);
      $('.tpp-radio-blue').prop("checked", true);
    }
    );

    $('.tpp-radio-red + label').click(function () {
      betTeam = 'red';
      $('.tpp-radio').prop("checked", false);
      $('.tpp-radio-red').prop("checked", true);
    }
    );

    $('#autoPinball + span').click(function () {
      $('#autoPinball').prop("checked", !$('#autoPinball').prop("checked"));
      autopinball = $('#autoPinball').prop("checked");
      console.log(autopinball);
    }
    );

    $("#autoBet + span").click(function () {
      $("#autoBet").prop("checked", !$("#autoBet").prop("checked"));
      autobet = $("#autoBet").prop("checked");
      console.log(autobet);
    });

    $(".tpp-buttons-controls1 .tpp-button-grid-controls input[type='radio'] + label").click(function () {
      move["1"] = $(this).prev().val();
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    });

    $(".tpp-buttons-controls1 .tpp-button-grid-target input[type='radio'] + label").click(function () {
      move["2"] = $(this).prev().val();
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    }
    );

    $(".tpp-buttons-controls1 .tpp-button-grid-switch input[type='radio'] + label").click(function () {
      move["1"] = $(this).prev().val().toString();
      move["2"] = "-";
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    });

    $(".tpp-buttons-controls2 .tpp-button-grid-controls input[type='radio'] + label").click(function () {
      move["3"] = $(this).prev().val();
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    }
    );

    $(".tpp-buttons-controls2 .tpp-button-grid-target input[type='radio'] + label").click(function () {
      move["4"] = $(this).prev().val();
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    }

    );

    $(".tpp-buttons-controls2 .tpp-button-grid-switch input[type='radio'] + label").click(function () {
      move["3"] = $(this).prev().val().toString();
      move["4"] = "-";
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
    }
    );

    $(".tpp-buttons-controls-submit").click(function () {
      $(".tpp-value-controls-field").val(move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"]);
      var moveString = move["symbol"] + move["1"] + move["2"] + move["3"] + move["4"];

      if (moveString === "!----") {
        moveString = "!-";
      }

      if (move["3"] === "-" && move["4"] === "-") {
        moveString = move["symbol"] + move["1"] + move["2"];
      } else if (move["2"] === "-" && move["3"] === "-" && move["4"] === "-") {
        moveString = move["symbol"] + move["1"];
      }

      sendMessageToTwitchChat(moveString);
    });
    updateBalance();
  });
}


initialize();


var css = `
.tpp-buttons button,
.tpp-button {
  display: inline-flex;
  position: relative;
  -moz-box-align: center;
  align-items: center;
  -moz-box-pack: center;
  justify-content: center;
  vertical-align: middle;
  overflow: hidden;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  font-weight: var(--font-weight-semibold);
  font-size: var(--button-text-default);
  height: var(--button-size-default);
  border-radius: var(--input-border-radius-default);
  padding: 10px 8px;
  background-color: #35353b;
  color: #ececec;
  border: 2px solid #35353b;
  transition: 0.1s ease;
}

.tpp-buttons {
  display: flex;
  gap: 12px;
  padding: 0 8px 8px 8px;
  color: var(--color-text-alt-2);
  font-size: 13px;
  order: 1;
}

.tpp-buttons-details {
  border: 1px solid var(--color-background-button-secondary-default);
  border-radius: 6px;
  padding: 8px 12px;
}

.tpp-buttons-inner {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tpp-value-field {
  font: inherit;
  height: var(--button-size-default);
  border-radius: var(--input-border-radius-default);
  background-color: var(--color-background-body);
  color: var(--color-text-button-secondary);
  padding: 10px 8px;
  border: 0;
  height: 31px;
  margin-top: 12px;
  margin-block-end: 0;
  -moz-appearance: textfield;
  width: 50px;
  margin: 0px;
  margin-block-end: 0;
  height: 32px;
  margin-top: 1px;
}

.tpp-value-balance-field {
  width: 172px;
}

.tpp-value-field::-webkit-inner-spin-button,
.tpp-value-field::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tpp-buttons-row {
  gap: 2px;
  align-items: center;
  justify-content: flex-start;
  display: flex;
  flex-direction: row;
}

/* Inline | https://www.twitch.tv/twitchplayspokemon/ */

.tpp-buttons .tpp-value-up,
.tpp-buttons .tpp-value-down,
.tpp-buttons .tpp-pinball-value-up,
.tpp-buttons .tpp-pinball-value-down {
  font-size: 18px;
  color: var(--color-text-alt-2);
  line-height: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-direction: row;
  margin: 0;
}

input.tpp-radio+label {
  border: 2px solid transparent;
}

input.tpp-radio-red[type="radio"]:checked+label {

  color: rgb(249, 150, 150);
  border: 2px solid rgb(185, 47, 47);
  background-color: rgb(60, 26, 26);
  cursor: pointer;
}

input.tpp-radio-blue[type="radio"]:checked+label {
  color: rgb(184, 201, 238);
  border: 2px solid #2f2fb9;
  background-color: #1a1a3c;
  cursor: pointer;
}

.tpp-buttons-controls input[type="radio"]:checked+label {
  color: #ececec;
  border: 2px solid #35353b;
  background-color: #1a1a1d;
  cursor: pointer;
}

.tpp-radiogroup input[type="radio"] {
  visibility: hidden;
  position: fixed;
}

.tpp-buttons-inner>.tpp-buttons-row:not(:last-of-type),
.tpp-buttons-row-controls .tpp-buttons-row:not(:last-of-type) {
  border-bottom: 2px solid var(--color-background-alt-2);
  padding-bottom: 10px;
}

.pinballready::after {
  content: ".";
  background-color: #fff;
  width: 8px;
  height: 8px;
  display: inline-flex;
  color: transparent;
  margin: auto;
  line-height: 0;
  vertical-align: middle;
  margin: 0 0 0 6px;
  border-radius: 20px;
}


.tpp-buttons button:hover,
.tpp-button:hover {
  border-color: var(--color-background-accent);
  background-color: #1a1a1d;
}

.tpp-checkbox-container {
  display: block;
  position: relative;
  padding-left: 35px;
  margin-bottom: 12px;
  cursor: pointer;
  font-size: 22px;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  padding-left: 0;
  width: 30px;
  height: 30px;
  margin: 0;
  padding: 0;
}

.tpp-checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.tpp-checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 30px;
  width: 30px;
  background-color: var(--color-background-body);
  border-radius: var(--input-border-radius-default);
  border: 2px solid #35353b;
  transition: 0.1s ease;
}

.tpp-checkbox-container:hover input~.tpp-checkmark {
  background-color: #35353b;
}

.tpp-checkbox-container input:checked~.tpp-checkmark {
  background-color: var(--color-accent);
}

.tpp-checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.tpp-checkbox-container input:checked~.tpp-checkmark:after {
  display: block;
}

.tpp-checkbox-container .tpp-checkmark:after {
  left: 9px;
  top: 5px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 3px 3px 0;
  -webkit-transform: rotate(45deg);
  -ms-transform: rotate(45deg);
  transform: rotate(45deg);
}


.tpp-button-grid .tpp-radiogroup {
  display: flex;
  width: 30px;
  height: 30px;
}

.tpp-button-grid {
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-column-gap: 0px;
  grid-row-gap: 0px;
}

.tpp-buttons-controls .tpp-radiogroup:nth-child(1) label.tpp-button {
  border-radius: 4px 0 0 0;
}

.tpp-buttons-controls .tpp-radiogroup:nth-child(2) label.tpp-button {
  border-radius: 0 4px 0 0;
}

.tpp-buttons-controls .tpp-radiogroup:nth-child(3) label.tpp-button {
  border-radius: 0 0 0 4px;
}

.tpp-buttons-controls .tpp-radiogroup:nth-child(4) label.tpp-button {
  border-radius: 0 0 4px 0;
}

.tpp-button-grid .tpp-radiogroup {
  width: 22px;
  height: 22px;
}

.tpp-buttons-controls label.tpp-button {
  width: 100%;
  height: 100%;
}

.tpp-buttons-column {
  display: inline-block;
  flex-direction: column;
  gap: 3px;
}

.tpp-button-grid-controls input[value="A"]+label.tpp-button {
  color: rgb(249, 150, 150);
  border-color: rgb(249, 150, 150, 0.5);
}

.tpp-button-grid-controls input[value="B"]+label.tpp-button {
  color: rgb(184, 201, 238);
  border-color: rgb(184, 201, 238, 0.5);
}

.tpp-button-grid-controls input[value="C"]+label.tpp-button {
  color: rgb(184, 238, 196);
  border-color: rgb(184, 238, 196, 0.5);
}

.tpp-button-grid-controls input[value="D"]+label.tpp-button {
  color: rgb(238, 233, 184);
  border-color: rgb(238, 233, 184, 0.5);
}

.tpp-buttons-controls .tpp-button-grid .tpp-button {
  background: transparent;
  border: 2px solid #35353b;
  font-size: 8px;
}

.tpp-buttons-controls-buttons {
  margin-top: 8px;
}

.tpp-value-controls-field {
  width: 60px;
}

.tpp-checkbox-container input:not(:checked)+.tpp-checkmark::before {
  content: "⟳";
  color: #ffffff3d;
  top: -5px;
  position: absolute;
  left: 4px;
}

`
