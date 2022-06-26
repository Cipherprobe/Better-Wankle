class Piss {
	constructor(x, y, angle) {
		this.radius = PISS_RADIUS;
		this.angle = angle + (Math.random() < 0.5 ? Math.random() * 15 : -Math.random() * 15) * Math.PI / 180;
		this.x = x;
		this.y = y;
		this.color = "#FEF600";
		this.opacity = 1;
		this.speed = 8000;
	}

	update() {
		//if player ISNT dead, update particles
		if (!STAGE_CACHE.player.dead) {
			//GOAL: Make particles of different size spew out in direction of player, slowing to a halt and laying there

			this.speed /= 120 * deltaTime;
			this.opacity -= 4 * deltaTime;

			//update position
			this.x += this.speed * Math.cos(this.angle) * deltaTime;
			this.y += this.speed * Math.sin(this.angle) * deltaTime;

			if (this.opacity <= 0) {
				this.explode = true;
			}
		}
	}

	render() {
		//RENDER PARTICLE
		ctx.shadowBlur = 10;
		ctx.shadowColor = this.color;

		//color in rgba to support opacity
		ctx.fillStyle = hexToRgbA(this.color, this.opacity);
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
		ctx.fill();

		ctx.shadowBlur = 0;
	}
}

//color code: bodyColor, turretColor, sideColor
class Player {
	constructor(x, y, angle, turretAngle) {
		//ID
		this.tankID = PLAYER_ID;

		this.tank = new Tank(x, y, angle, turretAngle, "#224ACF", "#1E42B8", "#0101BA", 100, 3, this.tankID);
		this.moving = false;
		this.dead = false;

		//makes tank "shock" aka pause for a split second due to recoil from shot or mine
		this.tankShock = 0;

		//delays shell spamming
		this.shellDelay = 0.1;

		//caps number of shells to be shot/keeps track of how many shells are shot by this tank
		this.shellShot = 0;

		//caps number of mines layed
		this.mineLayed = 0;

		//delays mine spamming
		this.mineDelay = 50;

		this.keys = {};

		//bruh
		this.pee = false;
		this.pissStream = [];
	}

	update() {
		//update tankBody
		this.tank.updateBody();

		//update turret angle
		this.tank.turretAngle = Math.atan2(MOUSE_POS.y - this.tank.centerY, MOUSE_POS.x - this.tank.centerX);

		//update tankShock
		this.tankShock += deltaTime;

		//update shellDelay
		this.shellDelay += deltaTime;

		//update mineDelay
		this.mineDelay += deltaTime;

		//update movement
		const xInc = this.tank.speed * Math.cos(this.tank.angle) * deltaTime;
		const yInc = this.tank.speed * Math.sin(this.tank.angle) * deltaTime;

		//moving trackers
		var isUp = false;
		var isDown = false;

		//if tank is NOT SHELLSHOCKED and isn't dead
		if (this.tankShock > 0 && !this.dead) {
			//up
			if (this.keys[87] || this.keys[38]) {
				this.tank.x += xInc;
				this.tank.y += yInc;
				isUp = true;
			}

			//down
			if (this.keys[83] || this.keys[40]) {
				this.tank.x -= xInc;
				this.tank.y -= yInc;
				isDown = true;
			}

			//update moving trackers
			if ((isUp == false && isDown == false) || (isUp == true && isDown == true)) {
				this.moving = false;
			} else {
				this.moving = true;
			}

			//right rotation
			if (this.keys[65] || this.keys[37]) {
				this.tank.angle -= this.tank.rotationSpeed * deltaTime;
			}

			//left rotation
			if (this.keys[68] || this.keys[39]) {
				this.tank.angle += this.tank.rotationSpeed * deltaTime;
			}

			//check for keybind for laying mines
			if (this.keys[32]) {
				//lay mine
				this.layMine();
				delete this.keys[32];
			}
		}

		//update pee hee hee (i am mickhel jeckson;!!(real))
		if (this.pee) {
			this.pissStream.push(new Piss(this.tank.centerX, this.tank.centerY, this.tank.angle));
		}

		for (var i = 0; i < this.pissStream.length; i++) {
			const pee = this.pissStream[i];

			if (pee.explode) {
				//DELETE PARTICLE
				this.pissStream.splice(i, 1);
				continue;
			}

			pee.update();
		}

		//update particles
		this.tank.updateParticles();
	}
	
	explode() {
		//die
		this.dead = true;
		this.tank.explodeTank();

		//start intermission
		intermissionStatus = INTERMISSION_RETRY;
		INTERMISSION = true;

		//add grave
		STAGE_CACHE.graves.push(new Grave(this.tank.centerX - GRAVE_WIDTH / 2, this.tank.centerY - GRAVE_HEIGHT / 2, this.tank.color));
	}

	shoot() {
		//delay shell fire rate && cap shell amount && isn't dead
		if (this.shellDelay > 0.01 && this.shellShot < 10 && !this.dead && !INTERMISSION) {
			this.tankShock = -0.1;
			this.shellShot++;
			this.shellDelay = 0;

			this.tank.shoot(MOUSE_POS, NORMAL_SHELL, this.tankID);		
		}
	}

	layMine() {
		if (this.mineLayed < 2 && this.mineDelay > 2 && !INTERMISSION) {
			this.tankShock = -0.2;
			this.mineLayed++;
			this.mineDelay = 0;

			this.tank.layMine(this.tankID);
		}
	}

	trackUpdate() {
		if (!this.dead) {
			this.tank.trackUpdate();			
		}
	}

	render() {
		//auuuuhh
		for (var i = 0; i < this.pissStream.length; i++) {
			this.pissStream[i].render();
		}

		this.tank.render(this.dead);
	}

	renderShadow() {
		this.tank.renderShadow(this.dead);
	}
}
