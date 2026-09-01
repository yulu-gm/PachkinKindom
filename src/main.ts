import'./styles.css';
import{createGame}from'./phaser/config';
import{GameController}from'./game/controller';
import{Hud}from'./ui/Hud';

window.addEventListener('error',event=>console.error('[弹珠王国] 未捕获错误',event.error??event.message));
window.addEventListener('unhandledrejection',event=>console.error('[弹珠王国] 未处理的 Promise 拒绝',event.reason));

const controller=new GameController();
new Hud(controller);
createGame('game-canvas',controller);
