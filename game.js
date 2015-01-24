/*global Phaser */

/**
 * @type {{epsilonDegrees: number, orbEllipseYX: number, orbRotationRadius: number, orbRotationPerMs: number, planetCenter: *[], orbRotationCenter: *[], planetRadius: number, orbRadius: number, timeScale: number, barWidth: number, barLength: number, barSpacing: number, barUnderDiff: number, modelParameterInertia: number, gameOverMaxThreshold: number, gameOverMinThreshold: number, messages: {maxThreshold: string[], minThreshold: string[]}, finalMessageStyle: {font: string, fill: string, align: string}}}
 */
var Logic = {
    epsilonDegrees: 0.001,
    orbEllipseYX: 0.15,
    orbRotationRadius: 300,
    orbRotationPerMs: 0.0001,
    planetCenter: [Math.round(1024/3*2), Math.round(768/3*2)],
    orbRotationCenter: [Math.round(1024/3*2), Math.round(768/3)],
    planetRadius: 200,
    orbRadius: 32,
    timeScale: 365.25/12 * 86400,
    barWidth: 48,
    barLength: 256,
    barSpacing: 120,
    barUnderDiff: 8,
    modelParameterInertia: 8000,
    gameOverMaxThreshold: 0.97,
    gameOverMinThreshold: 0.03,
    messages: { // war, love, work
        maxThreshold: [
            'self-destruction',
            'overpopulation',
            'pollution'
        ],
        minThreshold: [
            '',
            'extinction',
            'starvation'
        ],
        ggwp: 'ggwp'
    },
    finalMessageStyle: {
        font: '65px Arial',
        fill: '#af111c',
        color: '#af111c',
        align: 'center'
    },
    inputMixMatrix: [
        [1, -1/4, -1/4],
        [0, 2/3, 0],
        [0, 0, 2/3]
    ]
};

Logic.barSpacing = (2*Logic.planetRadius - 3 * Logic.barWidth) / 2;

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

/**
 * @param {number[]} inputs
 * @param {number[]} previousOutputs
 * @param {number} elapsed
 * @returns {number[]}
 */
Logic.model = function(inputs, previousOutputs, elapsed) {
    var outputs = inputs;

    var inputsAfterMix = Logic.multiplyMatrix(Logic.inputMixMatrix, [inputs])[0];

    for (var inputIndex in inputs) {
        if (inputs.hasOwnProperty(inputIndex)) {
            outputs[inputIndex] = Logic.outputLimiter(Logic.parameterDelay(previousOutputs[inputIndex], inputsAfterMix[inputIndex], elapsed));
        }
    }

    return outputs;
};

/**
 * @param {Array} m1
 * @param {Array} m2
 * @returns {Array}
 */
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
 * @param {number[]} outputs
 * @param {Phaser.Graphics[]} bars
 */
Logic.scaleBarsByOutputs = function (outputs, bars) {
    outputs.forEach(function (output, index) {
        bars[index].scale.x = output;
    });
};

/**
 * @param {number} currentValue
 * @param {number} targetValue
 * @param {number} elapsed
 * @returns {number}
 */
Logic.parameterDelay = function (currentValue, targetValue, elapsed) {
    return currentValue/(1 + elapsed/Logic.modelParameterInertia) +
        targetValue/(1 + Logic.modelParameterInertia/elapsed);
};

/**
 *
 * @param {number} output
 */
Logic.outputLimiter = function (output) {
    var result = output;

    result = Math.max(result, 0);
    result = Math.min(result, 1);

    return result;
};

/**
 *
 * @param {number[]} outputs
 * @returns {string}
 */
Logic.checkGameOver = function (outputs) {
    var result = '';

    for (var index in outputs) {
        if (outputs.hasOwnProperty(index)) {
            if (outputs[index] > Logic.gameOverMaxThreshold) {
                result = Logic.messages.maxThreshold[index];
            }

            if (outputs[index] < Logic.gameOverMinThreshold) {
                result = Logic.messages.minThreshold[index];
            }
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

    create: function () {

        var self = this;

        /**
         * @type {Phaser.Text[]}
         */
        self.texts = [];

        /**
         * @type {Orb[]}
         */
        self.possibleOrbs = [
            new Orb(self.game, 'war', 0),
            new Orb(self.game, 'love', 2*Math.PI/3),
            new Orb(self.game, 'work', 4*Math.PI/3)
        ];

        /**
         * @type {number[]}
         */
        self.orbColors = [
            0xe62839,
            0xffaec9,
            0x9f9f9f
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

        /**
         * @param {string} planetName
         */
        self.selectPlanet = function (planetName) {
            if (self.planet) {
                self.planet.destroy(true);
            }

            self.planet = self.game.add.sprite(Logic.planetCenter[0] - Logic.planetRadius, Logic.planetCenter[1] - Logic.planetRadius, planetName);
        };

        /**
         * @type {string}
         */
        self.planetSelected = 'planet';

        self.planetToggleKey.onDown.add(function () {
            self.planetSelected = self.planetSelected !== 'planet' ? 'planet' : 'planet-2';
            self.selectPlanet(self.planetSelected);
        }, this);

        self.game.world.setBounds(0, 0, 1024, 768);
        self.space = self.game.add.tileSprite(0, 0, 1024, 768, 'space');
        self.selectPlanet(self.planetSelected);

        self.helpText = self.game.add.text(
            1024/2,
            100,
            'Use Q, W, E to manage Earth. Live long & prosper!',
            {font: '24px Arial', fill: '#dddddd', align: 'center'}
        );

        self.helpText.anchor.set(0.5, 0.5);

        /**
         * @type {Phaser.Graphics[]}
         */
        self.bars = [];
        self.underBars = [];

        /**
         * @type {Phaser.Sprite[]}
         */
        self.barIcons = [];

        /**
         * @type {Phaser.Text[]}
         */
        self.barIconTexts = [];

        self.possibleOrbs.forEach(function (orb, orbIndex) {
            var positionY = Logic.planetCenter[1] - Logic.planetRadius + Logic.barWidth/2*3 + orbIndex * Logic.barSpacing;

            self.underBars[orbIndex] = self.game.add.graphics(100 - Logic.barUnderDiff/2, positionY);
            self.underBars[orbIndex].lineStyle(Logic.barWidth + Logic.barUnderDiff, 0x464646, 1);
            self.underBars[orbIndex].moveTo(0, 0);
            self.underBars[orbIndex].lineTo(Logic.barLength + Logic.barUnderDiff, 0);

            self.bars[orbIndex] = self.game.add.graphics(100, positionY);
            self.bars[orbIndex].lineStyle(Logic.barWidth, self.orbColors[orbIndex], 1);
            self.bars[orbIndex].moveTo(0, 0);
            self.bars[orbIndex].lineTo(Logic.barLength, 0);

            self.barIcons[orbIndex] = self.game.add.sprite(20 + Logic.orbRadius, positionY, orb.id + '-orb');
            self.barIcons[orbIndex].anchor.setTo(0.5, 0.5);

            self.barIconTexts[orbIndex] = self.game.add.text(
                20 + 1.7*Logic.orbRadius,
                positionY + 10, self.orbChars[orbIndex],
                {font: '20px Arial', fill: '#ffffff', align:'center'}
            );
        });

        console.log(JSON.stringify(self.getModelInputs()));

        self.game.time.advancedTiming = true;

        /**
         * @type {string}
         */
        self.finalMessage = '';

        /**
         * @type {number[]}
         */
        self.modelOutputs = [];

        self.possibleOrbs.forEach(function (orb, orbIndex) {
            self.modelOutputs[orbIndex] = self.getModelInputs()[orbIndex] / 3;
        });
    },

    update: function () {

        var self = this;

        self.orbs.forEach(function (orb) {
            orb.update(self.game.time.elapsedMS);
        });

        self.modelOutputs = Logic.model(self.getModelInputs(), self.modelOutputs, self.game.time.elapsedMS);

        if (self.finalMessage = Logic.checkGameOver(self.modelOutputs)) {
            self.game.paused = true;
        }

    },

    render: function () {

        var self = this;

        var debugObj = {};

        //debugObj.fps = self.game.time.fps;
        //debugObj.modelOutputs = self.modelOutputs;

        var count = 0;

        for (var debugKey in debugObj) {
            if (debugObj.hasOwnProperty(debugKey)) {
                self.game.debug.text(debugKey + ': ' + debugObj[debugKey], 32, ++count * 16);
            }
        }

        self.game.debug.text(
            Logic.dateFormat(Logic.getDateNow(self.game.time.now)),
            150,
            Logic.planetCenter[1] - Logic.planetRadius - 50
        );

        Logic.scaleBarsByOutputs(self.modelOutputs, self.bars);

        if (self.finalMessage) {
            self.texts.push(
                self.game.add.text(Logic.planetCenter[0], Logic.planetCenter[1] - 80, Logic.messages.ggwp, Logic.finalMessageStyle)
            );

            self.texts.push(
                self.game.add.text(Logic.planetCenter[0], Logic.planetCenter[1], self.finalMessage, Logic.finalMessageStyle)
            );

            self.texts.forEach(function (text) {
                text.anchor.set(0.5, 0.5);
            });
        }

    }

};
