class TealTank {
	constructor(x, y, angle, turretAngle) {
		//ID
		this.tankID = Math.floor(Math.random() * 100000);

		this.tank = new Tank(x, y, angle, turretAngle, "#154734", "#0E4732", "#B0896B", 65, 1, this.tankID);
		this.tankType = TEAL_TANK;
		this.bounces = 0;
		this.dead = false;


		//movement update

		//mines that are remembered
		this.mineMemory = [];

		//makes tank "shock" aka pause for a split second due to recoil from shot or mine
		this.tankShock = 0;
		this.tankRotation = 0;
		this.uTurning = false;
		this.avoiding = false;
		this.tankRotationDelay = 0;
		this.tankRotationCap = 0.02;

		//turret update
		this.shellDetectionRadius = 250;

		//lock on to player
		this.goalRot = turretAngle * Math.PI / 180;

		//(60 * deltaTime) == 1 deg
		this.lockedOn = false;
		this.turretRotation = 500 * deltaTime * Math.PI / 180;
		this.shellDelay = 1;
	}

	//cast a ray to player
	castToPlayer(ray, angle, bouncesLeft, firstShot, collidedSideID) {
		//check for comrade collisions overall. If a ray has a comrade collision it should not be taken
		const comradeCollision = getComradeCollisions(ray, angle, firstShot, this.tankID);

		if (!comradeCollision.reflection) {
			//it doesn't matter how many bounces are left, it matters if the tank is still alive. check for incoming shells and remove the threat
			const shellCollision = getShellCollisions(ray, angle);

			//check if shell is within a certain target radius, aka close enough for it to be a threat
			if (shellCollision.dist <= this.shellDetectionRadius) {
				//check if any walls are in the way
				const wallCollision = getWallCollisions(new Ray(ray.pointA, shellCollision.reflection.point), angle, collidedSideID);

				if (!wallCollision.reflection) {
					//no walls are in the way!

					/*technically did not detect player, but that's what i will use for object detection*/
					return {
						detectPlayer: true,
						noWalls: true
					};
				}

				//if there was a wall collision, then continue normally
			}

			const playerCollision = getPlayerCollisions(ray, angle, false);

			if (bouncesLeft > 0) {
				//found a player collision before hitting 0 bounces!
				if (playerCollision.reflection) {
					//check if any walls are in the way
					const wallCollision = getWallCollisions(new Ray(ray.pointA, playerCollision.reflection.point), angle, collidedSideID);

					if (!wallCollision.reflection) {
						//no walls are in the way!
						return {
							detectPlayer: true,
							noWalls: true
						};
					} else {
						//bounce off the wall we have detected!
						return this.castToPlayer(wallCollision.reflection.newRay, wallCollision.reflection.newAngle, bouncesLeft - 1, false, wallCollision.id);
					}
				} else {
					const wallCollision = getWallCollisions(ray, angle, collidedSideID);

					if (wallCollision.reflection) {
						return this.castToPlayer(wallCollision.reflection.newRay, wallCollision.reflection.newAngle, bouncesLeft - 1, false, wallCollision.id);
					} else {
						const borderCollision = getBorderCollisions(ray, angle, collidedSideID);

						//terminate
						if (!borderCollision.reflection) return {
							detectPlayer: false,
							noWalls: false
						};

						return this.castToPlayer(borderCollision.reflection.newRay, borderCollision.reflection.newAngle, bouncesLeft - 1, false, borderCollision.id);
					}
				}
			} else {
				//must hit player on last round
				if (playerCollision.reflection) {
					//check if any walls are in the way
					const wallCollision = getWallCollisions(new Ray(ray.pointA, playerCollision.reflection.point), angle, collidedSideID);

					if (!wallCollision.reflection) {
						//no walls are in the way!
						return {
							detectPlayer: true,
							noWalls: true
						};
					} else {
						//some walls are in the way :(
						return {
							detectPlayer: true,
							noWalls: false
						};
					}
				} else {
					//doesn't hit player :(
					return {
						detectPlayer: false,
						noWalls: false
					};
				}
			}
		} else {
			return {
				detectPlayer: false,
				noWalls: false
			};
		}
	}

	shouldFire(ray) {
		const perpAngle = getPerpAngle(this.tank.angle);
		const Cos = Math.cos(perpAngle) * SHELL_HEIGHT * MOBILE_RAY_OFFSET;
		const Sin = Math.sin(perpAngle) * SHELL_HEIGHT * MOBILE_RAY_OFFSET;
		
		//left ray
		const leftRay = new Ray(new xy(ray.pointA.x + Cos, ray.pointA.y + Sin), new xy(ray.pointB.x + Cos, ray.pointB.y + Sin));
		
		//right ray
		const rightRay = new Ray(new xy(ray.pointA.x - Cos, ray.pointA.y - Sin), new xy(ray.pointB.x - Cos, ray.pointB.y - Sin));

		//leftCast
		const leftCast = this.castToPlayer(leftRay, this.tank.turretAngle, this.bounces, true, null);

		//rightCast
		const rightCast = this.castToPlayer(rightRay, this.tank.turretAngle, this.bounces, true, null);

		//if either ray collide with player, lock on. If there are no walls, shoot!

		if (leftCast.detectPlayer && rightCast.detectPlayer) {
			if (leftCast.noWalls && rightCast.noWalls) {
				return true;
			}
		}
	}

	matchMineID(mineID) {
		for (var i = 0; i < this.mineMemory.length; i++) {
			if (this.mineMemory[i] == mineID) {
				return {
					i: i
				};
			}
		}

		return false;
	}

	dodgeMines() {
		for (var i = 0; i < STAGE_CACHE.mines.length; i++) {
			const mine = STAGE_CACHE.mines[i];

			if (SAT_POLYGON_CIRCLE(this.tank, {
				x: mine.x,
				y: mine.y,
				radius: MINE_EXPLOSION_RADIUS * 2
			})) {
				//if we have not already dodged this mine
				if (!this.matchMineID(mine.id)) {
					this.mineMemory.push(mine.id);

					//hit a 180 babyyy
					this.tankRotation = 10800 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;
				}
			} else {
				const mineImprint = this.matchMineID(mine.id);
				
				//if we are no longer touching the mine but we remember it, forget about the mine
				if (mineImprint) {
					this.mineMemory.splice(mineImprint.i, 1);
				}
			}
		}
	}

	dodgeShells() {
		for (var i = 0; i < STAGE_CACHE.shells.length; i++) {
			const shell = STAGE_CACHE.shells[i];
			
			//if the shell is not diminishing
			if (!shell.diminish) {
				const tankCoord = new xy(this.tank.centerX, this.tank.centerY);
				const shellCoord = new xy(shell.centerX, shell.centerY);

				const shellDist = getRayLength(tankCoord, shellCoord);

				//if the shell is getting too close and it is going to hit the tank, avoid!
				if (shellDist <= this.shellDetectionRadius) {
					const shellEndPoint = new xy(shellCoord.x + Math.cos(shell.angle) * 1000, shellCoord.y + Math.sin(shell.angle) * 1000);

					//extend the tank's width to make the tanks predict ahead of time (funny idea!)
					const tankClone = {...this.tank};
					tankClone.width += 20;

					const intersection = singleShellCollision(new Ray(shellCoord, shellEndPoint), tankClone);

					if (intersection.reflection) {
						if (intersection.side == 0 || intersection.side == 3) {
							//sharp turn left, left or bottom
							this.tankRotation = 540 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;

						} else {
							//sharp turn right, right or top
							this.tankRotation = -540 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;
						}

						if (!this.avoiding) {
							this.avoiding = true;
							this.tank.speed *= 2;
						}

						return true;
					} else {
						if (this.avoiding) {
							this.avoiding = false;
							this.tank.speed /= 2;
						}
					}
				}
			}
		}
	}

	getRandomBodyRot() {
		//return a random rotation for the tank to travel with in radians
		//degree difference from -10 to 10
		const max = 200;
		const min = -200;
		return ((Math.random() * (max - min) + min) * deltaTime * this.tank.rotationSpeed) * Math.PI / 180;
	}

	update() {
		if (!STAGE_CACHE.player.dead && !this.dead) {
			//update limiters
			this.shellDelay += deltaTime;

			//update tankShock
			this.tankShock += deltaTime;

			//update tank angle
			this.tankRotationDelay += deltaTime;

			//update tankbody
			this.tank.updateBody();

			if (this.tankRotationDelay > this.tankRotationCap) {
				this.tankRotationDelay = 0;
				this.tank.angle += this.tankRotation;

				//do not let regular movement affect movement when dodging shells
				if (!this.dodgeShells()) {
					const foreignCollision = getForeignCollisions(this.tank);
					if (foreignCollision) {
						//about to collide, don't idle
						switch (foreignCollision) {
							case U_TURN:
								this.tankRotation = -1400 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;
								if (!this.uTurning) {
									this.uTurning = true;
									this.tank.speed /= 2;
								}
								break;
							case TURN_LEFT:
								//5 degrees
								this.tankRotation = 280 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;
								if (this.uTurning) {
									this.uTurning = false;
									this.tank.speed *= 2;
								}
								break;
							case TURN_RIGHT:
								//-5 degrees
								this.tankRotation = -280 * deltaTime * this.tank.rotationSpeed * Math.PI / 180;
								if (this.uTurning) {
									this.uTurning = false;
									this.tank.speed *= 2;
								}
								break;
						}
					} else {
						if (this.uTurning) {
							this.uTurning = false;
							this.tank.speed *= 2;
						}

						this.tankRotation = this.getRandomBodyRot();
					}
				}
				this.dodgeMines();
			}

			//update movement if tank is not shocked!
			if (this.tankShock > 0) {
				const xInc = this.tank.speed * Math.cos(this.tank.angle) * deltaTime;
				const yInc = this.tank.speed * Math.sin(this.tank.angle) * deltaTime;

				this.tank.x += xInc;
				this.tank.y += yInc;
			}

			//update turret
			this.goalRot = Math.atan2(STAGE_CACHE.player.tank.y - this.tank.y, STAGE_CACHE.player.tank.x - this.tank.x);

			//adjust angles to stay with bounds
			if (Math.sign(this.goalRot) !== 1) {
				this.goalRot += 2 * Math.PI;
			}

			if (Math.sign(this.tank.turretAngle) !== 1) {
				this.tank.turretAngle += 2 * Math.PI;
			}

			this.goalRot %= 2 * Math.PI;
			this.tank.turretAngle %= 2 * Math.PI;

			//lock on turret
			if (!this.lockedOn) {
				//check if goalRot has been met :)
				if (this.tank.turretAngle < this.goalRot) {
					//if this used to be under...
					if (this.tank.turretAngle + (5 * Math.PI / 180) >= this.goalRot) {
						this.lockedOn = true;
					}
				} else {
					//if this used to be over...
					if (this.tank.turretAngle - (5 * Math.PI / 180) <= this.goalRot) {
						this.lockedOn = true;
					}
				}

				this.tank.turretAngle += this.turretRotation;
			} else {
				this.tank.turretAngle = this.goalRot;
			}

			//update shooting
			const shootCoordinates = new xy(1500 * Math.cos(this.tank.turretAngle) + this.tank.centerX, 1500 * Math.sin(this.tank.turretAngle) + this.tank.centerY);

			const ray = new Ray(new xy(this.tank.centerX, this.tank.centerY), shootCoordinates);

			if (this.shouldFire(ray) && this.shellDelay > 1.45) {
				//it found the ray to fire upon
				this.shellDelay = 0;
				this.tankShock = -0.1;
				this.tank.shoot(shootCoordinates, MISSLE, this.tankID);
			}
		}

		//update particles
		this.tank.updateParticles();
	}

	trackUpdate() {
		if (!this.dead) {
			this.tank.trackUpdate();
		}
	}

	explode() {
		//die
		this.dead = true;
		this.tank.explodeTank();

		//start intermission
		//the last enemy tank has been killed, you win this match!
		if (checkGameOver()) {
			intermissionStatus = INTERMISSION_WON;
			INTERMISSION = true;
		}

		//add grave
		STAGE_CACHE.graves.push(new Grave(this.tank.centerX - GRAVE_WIDTH / 2, this.tank.centerY - GRAVE_HEIGHT / 2, this.tank.color));
	}

	render() {
		this.tank.render(this.dead);
	}

	renderShadow() {
		this.tank.renderShadow(this.dead);
	}
}