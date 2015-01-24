/*global Phaser */

/**
 *
 * @type {{epsilonDegrees: number, orbEllipseYX: number, orbRotationRadius: number, orbRotationPerMs: number, planetCenter: *[], orbRotationCenter: *[], planetRadius: number, orbRadius: number, timeScale: number}}
 */
var Logic = {
    'epsilonDegrees': 0.001,
    'orbEllipseYX': 0.15,
    'orbRotationRadius': 300,
    'orbRotationPerMs': 0.0001,
    'planetCenter': [Math.round(1024/3*2), Math.round(768/3*2)],
    'orbRotationCenter': [Math.round(1024/3*2), Math.round(768/3)],
    'planetRadius': 200,
    'orbRadius': 32,
    'timeScale': 365.25/12 * 86400
};

/**
 * Makes rotation to be -180 <= x <= 180
 *
 * @param {number} rotation - in degrees
 * @returns {number} - degrees
 */
Logic.normalizeRotation = function (rotation) {
    var result = rotation;

    while (Math.abs(result) > Math.PI + Logic.epsilonDegrees) {
        result -= result / Math.abs(result) * 2 * Math.PI;
    }

    return result;
};

/**
 * @param {number} elapsed
 * @returns {number}
 */
Logic.getDateNow = function (elapsed) {
    return elapsed * Logic.timeScale + Date.now();
};

/**
 * @param {number} timestamp
 * @returns {string}
 */
Logic.dateFormat = function (timestamp) {
    var date = new Date(timestamp);
    var years = date.getFullYear().toString();
    var months = (date.getMonth()+1).toString(); // getMonth() is zero-based
    var days  = date.getDate().toString();
    return years + '-' + (months[1]?months:"0"+months[0]) + '-' + (days[1]?days:"0"+days[0]);
};

Logic.model = function(inputs) {
    var outputs = inputs;

    for (var outputIndex in outputs) {
        if (outputs.hasOwnProperty(outputIndex)) {
            outputs[outputIndex] /= 3;
        }
    }

    return outputs;
};

Logic.multiplyMatrix = function (m1, m2) {
    var result = [];
    for(var j = 0; j < m2.length; j++) {
        result[j] = [];
        for(var k = 0; k < m1[0].length; k++) {
            var sum = 0;
            for(var i = 0; i < m1.length; i++) {
                sum += m1[i][k] * m2[j][i];
            }
            result[j].push(sum);
        }
    }
    return result;
};

/**
 *
 * @param {Phaser.Game} game
 * @param {string} orbId
 * @param {number} baseRotation
 * @constructor
 */
var Orb = function (game, orbId, baseRotation) {

    /**
     * @type {Phaser.Game}
     */
    this.game = game;

    /**
     * @type {string}
     */
    this.id = orbId;

    /**
     * @type {number}
     */
    this.rotation = Logic.normalizeRotation(baseRotation);

    this.setRotation = function (rotation) {
        this.rotation = Logic.normalizeRotation(rotation);
    };

    this.getRotationX = function () {
        return Logic.orbRotationRadius * Math.cos(this.rotation);
    };

    this.getRotationY = function () {
        return Logic.orbEllipseYX * Logic.orbRotationRadius * Math.sin(this.rotation);
    };

    /**
     * @type {Phaser.Sprite}
     */
    this.sprite = this.game.add.sprite(0, 0, this.id + '-orb');

    this.sprite.anchor.setTo(0.5, 0.5);

    /**
     *
     * @param {number} elapsed
     */
    this.update = function (elapsed) {
        this.updateRotation(elapsed);
        this.updatePosition();
    };

    /**
     * @param {number} elapsed
     */
    this.updateRotation = function (elapsed) {
        this.setRotation(this.rotation + Logic.orbRotationPerMs * elapsed);
    };

    this.updatePosition = function () {
        this.sprite.x = this.getRotationX() + Logic.orbRotationCenter[0];
        this.sprite.y = this.getRotationY() + Logic.orbRotationCenter[1];

        var scale = 0.67 + 0.33 * Math.sin(this.rotation);

        this.sprite.scale.set(scale , scale);

        this.sprite.bringToTop();
    };

    this.removeSprite = function () {
        this.sprite.destroy(true)
    };
};

var Game = function (game) {};

Game.prototype = {

    preload: function () {



    },

    create: function () {

        var self = this;

        /**
         *
         * @type {Orb[]}
         */
        self.possibleOrbs = [
            new Orb(self.game, 'war', 0),
            new Orb(self.game, 'love', 2*Math.PI/3),
            new Orb(self.game, 'work', 4*Math.PI/3)
        ];

        /**
         * @type {string[]}
         */
        self.orbChars = ['Q', 'W', 'E'];

        self.orbKeys = {};
        self.addOrbFunctions = {};

        self.possibleOrbs.forEach(function (orb, orbIndex) {
            self.orbKeys[orb.id] = self.game.input.keyboard.addKey(
                Phaser.Keyboard[self.orbChars[orbIndex]]
            );

            self.addOrbFunctions[orb.id] = function () {
                self.addOrb(orb.id);
                console.log('On key added ' + orb.id + ' => ' + JSON.stringify(self.getModelInputs()));
            };
        });

        /**
         * @type {Orb[]}
         */
        self.orbs = [self.possibleOrbs[0], self.possibleOrbs[1], self.possibleOrbs[2]];

        /**
         *
         * @param {string} orbId
         */
        self.addOrb = function (orbId) {
            var orb = null;

            for (var currentOrbIndex in self.possibleOrbs) {
                if (self.possibleOrbs.hasOwnProperty(currentOrbIndex) && self.possibleOrbs[currentOrbIndex].id === orbId) {
                    orb = self.possibleOrbs[currentOrbIndex];
                }
            }

            if (orb) {
                var newOrb = new Orb(self.game, orb.id, self.orbs[0].rotation);
                // new orb gets current rotation of orb to be removed

                self.orbs.push(newOrb);
            }

            if (self.orbs.length > 3) {
                var removedOrb = self.orbs.shift();
                removedOrb.removeSprite();

            }
        };

        for (var orbKeyIndex in self.orbKeys) {
            if (self.orbKeys.hasOwnProperty(orbKeyIndex)) {
                self.orbKeys[orbKeyIndex].onDown.add(self.addOrbFunctions[orbKeyIndex], this);
            }
        }

        /**
         * @returns {Array}
         */
        self.getModelInputs = function () {
            var result = [];

            self.possibleOrbs.forEach(function (orb, orbIndex) {
                result[orbIndex] = 0;
            });

            var orbIndex = -1;

            self.orbs.forEach(function (orb) {
                orbIndex = -1;

                for (var currentOrbIndex in self.possibleOrbs) {
                    if (self.possibleOrbs.hasOwnProperty(currentOrbIndex) && self.possibleOrbs[currentOrbIndex].id === orb.id) {
                        orbIndex = currentOrbIndex;
                    }
                }

                if (-1 !== orbIndex) {
                    result[orbIndex] = result[orbIndex] ? result[orbIndex] + 1 : 1;
                }

            });

            return result;
        };

        self.planetToggleKey = self.game.input.keyboard.addKey(
            Phaser.Keyboard.P
        );

        self.selectPlanet = function (planetName) {
            if (self.planet) {
                self.planet.destroy(true);
            }

            self.planet = self.game.add.sprite(Logic.planetCenter[0] - Logic.planetRadius, Logic.planetCenter[1] - Logic.planetRadius, planetName);
        };

        self.planetSelected = 'planet';

        self.planetToggleKey.onDown.add(function () {
            self.planetSelected = self.planetSelected !== 'planet' ? 'planet' : 'planet-2';
            self.selectPlanet(self.planetSelected);
        }, this);

        self.game.world.setBounds(0, 0, 1024, 768);
        self.space = self.game.add.tileSprite(0, 0, 1024, 768, 'space');
        self.selectPlanet(self.planetSelected);

        console.log(JSON.stringify(self.getModelInputs()));

        self.game.time.advancedTiming = true;

    },

    update: function () {

        var self = this;

        self.orbs.forEach(function (orb) {
            orb.update(self.game.time.elapsedMS);
        });

    },

    render: function () {

        var self = this;

        var debugObj = {};

        debugObj.fps = self.game.time.fps;
        debugObj.modelOutputs = Logic.model(self.getModelInputs());

        var count = 0;

        for (var debugKey in debugObj) {
            if (debugObj.hasOwnProperty(debugKey)) {
                self.game.debug.text(debugKey + ': ' + debugObj[debugKey], 32, ++count * 16);
            }
        }

        self.game.debug.text(
            Logic.dateFormat(Logic.getDateNow(self.game.time.now)),
            Logic.planetCenter[0] - 50,
            Logic.planetCenter[1] + Logic.planetRadius + 50
        );

    }

};
