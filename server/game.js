const { ja } = require("faker/lib/locales");

//actions: standing moving shooting blocking
const gravity = 0.02;
const courtSize = [1201, 443];
const midCourt = 601;
const playerSize = [69, 175];
const ballRadius = 25; 
const groundLevel = 409;
const netRect = [599, 191, 8, 220];
const playerShootArea = {
    leftPlayer: [42, 15, 65, 70],
    rightPlayer: [-31, 15, 65, 70]
};
const players = {
    leftPlayer: null,
    rightPlayer: null
}
const playerDefaultPos = {
    leftPlayer: [300 - playerSize[0], groundLevel - playerSize[1]],
    rightPlayer: [900, groundLevel - playerSize[1]]
};
const ballDefaultPos = [midCourt - ballRadius, 20];
const xBallVel = 0.4;
const ballDefaultVel = [xBallVel, 0];
const ballGMultiplier = 0.02;
let lastContact = null;
const playerVelInterval = [0.8, -2];
const playerTerritory = {
    leftPlayer: [0, midCourt - playerSize[0]],
    rightPlayer: [midCourt, 1201 - playerSize[0]]
}
const blockAreaSize = [50, 20]
const blockArea = {
    leftPlayer: [midCourt - blockAreaSize[0], 
    groundLevel - blockAreaSize[1], blockAreaSize[0], blockAreaSize[1]],
    rightPlayer: [midCourt, groundLevel - blockAreaSize[1],
    blockAreaSize[0], blockAreaSize[1]]
}
const scaleTicks = 11;
const scaleTickTime = 200;

const intDev = (x, y) => Math.floor(x / y);

function updateScale(gameState, currTime){
    const scale = gameState.scale
    if (scale.nextTick > currTime)    return false;
    if (scale.nextTick < currTime && scale.nextTick + scaleTickTime > currTime){
        if (scale.currTick + scale.trend >= scaleTicks || scale.currTick + scale.trend < 0){
            scale.trend *= -1;
        } 
        // console.log({
        //     currTick: scale.nextTick,
        //     currTime,
        //     nextTick: scale.nextTick + scaleTickTime,
        // })
        scale.nextTick = scale.nextTick + scaleTickTime;
        scale.currTick += scale.trend;
        return true;
    }
    const missedTicks = intDev((currTime - scale.nextTick), scaleTickTime);
    const missedTrends = intDev(missedTicks + scale.currTick, scaleTicks);
    if (missedTrends % 2 === 1){
        scale.trend *= -1;
        scale.currTick = scaleTicks - 1 - (scale.currTick + missedTicks) % scaleTicks; 
    }
    else{
        scale.currTick = (scale.currTick + missedTicks) % scaleTicks; 
    }
    
    scale.nextTick = scale.nextTick + scaleTickTime * (missedTicks + 1);
    return true
}

function initGame(){
    const gameState = {
        leftPlayer: {
            pos: [...playerDefaultPos['leftPlayer']],
            action: 'standing',
            vel: [0, 0],
            shootValue: null
        },
        rightPlayer: {
            pos: [...playerDefaultPos['rightPlayer']],
            action: 'standing',
            vel: [0, 0],
            shootValue: null
        },
        ball: {
            pos: [...ballDefaultPos],
            vel: [...ballDefaultVel]
        },
        scale: {
            currTick: 0,
            nextTick: scaleTickTime,
            trend: 1
        }
    }
    lastContact = null;

    if (Math.random() >= 0){
        gameState.ball.vel[0] *= -1;
    }
    return gameState;
}



function addPlayer(socketID) {
    if (!players['leftPlayer']){
        players['leftPlayer'] = socketID;
        return false;
    }
    else{
        players['rightPlayer'] = socketID;
        return true;
    }
}

function getPlayers(){
    return players;
}


function getPlayerName(playerId){
    if (playerId == players.leftPlayer){
        return 'leftPlayer';
    }
    else if(playerId == players.rightPlayer){
        return 'rightPlayer';
    }
    else{
        console.log("unknown playerID");
    }
}

function handleKeydown(gameState, socketID, eventCode){
    if (gameState){
        const playerName = getPlayerName(socketID);
        const player = gameState[playerName];
        switch (eventCode){
            case 'ArrowLeft':
                if (player.action !== 'shooting' &&
                    player.action !== 'blocking'){
                    player.action = 'moving';
                    console.log("moving")
                    player.vel[0] = -playerVelInterval[0];
                }
                break;
            case 'ArrowRight':
                if (player.action !== 'shooting' &&
                    player.action !== 'blocking'){
                    player.action = 'moving';
                    console.log("moving")
                    player.vel[0] = playerVelInterval[0]
                }
                break;
            case 'ArrowUp':
                if (player.action !== 'shooting' &&
                    player.action !== 'blocking'){
                    const playerRect = [...player.pos, ...playerSize];
                    if (rectRectCollision(playerRect, blockArea[playerName])){
                        player.action = 'blocking';
                        console.log("blocking");
                        player.vel[1] = playerVelInterval[1];
                        player.vel[0] = 0;
                    }
                }
                break;
            case 'Space':
                if (!player.shootValue){
                    player.shootValue = gameState.scale.currTick;
                    console.log(`${playerName} set shootValue at: ${player.shootValue}`);
                }
                break;      
        }    
    }
}

function handleKeyUp(gameState, socketID, eventCode){
    if (gameState){
        const playerName = getPlayerName(socketID);
        const player = gameState[playerName];
        switch (eventCode){
            case 'ArrowLeft':
                if (player.action === 'moving'){
                    player.action = 'standing';
                    player.vel[0] = 0;
                    console.log("movement left stopped")
                }
                break;
            case 'ArrowRight':
                if (player.action === 'moving'){
                    player.action = 'standing';
                    player.vel[0] = 0;
                }
                break;
        }    
    }
}


function updatePlayer(gameState, playerName, timeInterval){
    const player = gameState[playerName];
    const territory = playerTerritory[playerName];

    //position X
    let newX = player.pos[0] + player.vel[0] * timeInterval;
    if (newX < territory[0]){
        newX = territory[0];
        player.vel[0] = 0;
        player.action = 'standing';
    }
    else if(newX > territory[1]){
        newX = territory[1];
        player.vel[0] = 0;
        player.action = 'standing';
    }
    player.pos[0] = newX;

    //position Y
    let newY = player.pos[1] + player.vel[1] * timeInterval;
    if(newY > groundLevel - playerSize[1]){
        newY = groundLevel - playerSize[1];
        if (player.action === 'blocking'){
            player.pos[1] = groundLevel - playerSize[1];
            if (player.vel[0] != 0) {
                player.action = 'moving';
            }
            else{
                player.action = 'standing';
            }
        }
        player.vel[1] = 0;
    }
    player.pos[1] = newY;

    //velocity
    player.vel[1] += gravity * timeInterval;

    // shooting a ball
    // if (player.action === 'shooting'){
    const area = playerShootArea[playerName];
    const shootArea = [player.pos[0] + area[0], player.pos[1] + area[1], area[2], area[3]];
    const ballPos = [gameState.ball.pos[0] + ballRadius, gameState.ball.pos[1] + ballRadius];
    // console.log( `${shootArea}, ${gameState.ball.pos}, ${ballPos}`)
    if (rectCircleCollision(shootArea, ballPos, ballRadius)){
        shootBall(gameState, playerName);
        // console.log(gameState.ball.vel);
    }
    else{
        player.action = 'moving';
    }
}

function shootBall(gameState, playerName){
    const shootValue = gameState[playerName].shootValue;
    const dest = [0, 0];
    const ball = gameState.ball;
    if(playerName === "leftPlayer"){
        dest[0] = 900;
        ball.vel[0] = xBallVel;
    }
    else{
        dest[0] = 300;
        ball.vel[0] = -xBallVel;
    }
    const xInt = Math.abs(dest[0] - ball.pos[0])
    const time =  xInt / xBallVel;
    ball.vel[1] = -(gravity * time * 0.5 - xInt / time); 
    // console.log(`${playerName} shot ball with shootValue: ${shootValue}`);
    gameState[playerName].shootValue = null;
    lastContact = playerName;
}

function updateBall(gameState, timeInterval){
    // position
    const ball = gameState['ball'];
    ball.pos[0] += ball.vel[0] * timeInterval;
    ball.pos[1] += ball.vel[1] * timeInterval * ballGMultiplier;
    // velocity
    ball.vel[1] += gravity * timeInterval;
    if (ball.pos[0] < 0 || ball.pos[0] > courtSize[0] || ball.pos[1] < 0){
        return otherPlayer(lastContact);
    }

    if (ball.pos[1] > groundLevel){
        if (lastContact === 'rightPlayer'){
            if (ball.pos[0] < netRect[0] - ballRadius){
                return 'rightPlayer';
            }
            return 'leftPlayer';
        }
        if (ball.pos[0] < netRect[0] - ballRadius){
            return 'rightPlayer';
        }
        return 'leftPlayer';
    }
        
    if (rectCircleCollision(netRect, ball.pos, ballRadius)){
        return otherPlayer(lastContact);
    }

    return null;

    
}

function otherPlayer(playerName){
    if (playerName === "leftPlayer"){
        return "rightPlayer";
    }
    return "leftPlayer";
}

function rectCircleCollision(rect, cPos, cRadius){
    //circle definitelly don't overlap rect
    const res = cPos[0] < rect[0] - cRadius || rect[0] + rect[2] + cRadius < cPos[0] || 
        cPos[1] < rect[1] - cRadius || rect[1] + rect[3] + cRadius < cPos[1];
    if (res) return false;
    
    let xDiff = rect[0] - cPos[0];
    let yDiff = rect[1] - cPos[1];

    // rest except the rect edges
    if ((-rect[2] - cRadius < xDiff && xDiff < cRadius &&  -rect[3] < yDiff && yDiff < 0) || (
        -rect[3] -cRadius < yDiff && yDiff < cRadius && -rect[2] < xDiff && xDiff < 0)){
            return true;
        }
        
    // rect edges
    if (xDiff )
    if (yDiff <= -rect[3]){
        yDiff += rect[3];
    }
    if (xDiff <= -rect[2]){
        xDiff += rect[2];
    }
    // console.log(xDiff, yDiff);
    return xDiff * xDiff + yDiff * yDiff < cRadius * cRadius;
}

function rectRectCollision(recta, rectb){
    return !(recta[0] + recta[2] < rectb[0] ||
            recta[1] + recta[3] < rectb[1] ||
            recta[0] > rectb[0] + rectb[2] || 
            recta[1] > rectb[1] + rectb[3]) 
}


module.exports = {
    handleKeydown,
    updatePlayer,
    updateBall,
    initGame,
    addPlayer,
    handleKeyUp,
    updateScale,
    getPlayers,

    playerShootArea,
    netRect,
    blockArea,
    scaleTicks
}