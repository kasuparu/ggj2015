/*global Phaser */

var Game = function (game) {};

Game.prototype = {

    preload: function () {



    },

    create: function () {

        var self = this;

        /**
         * @type {string[]}
         */
        self.possibleOrbs = ['war', 'love', 'work'];

        /**
         * @type {string[]}
         */
        self.orbChars = ['Q', 'W', 'E'];

        self.orbKeys = {};
        self.addOrbFunctions = {};

        self.possibleOrbs.forEach(function (orb, orbIndex) {
            self.orbKeys[orb] = self.game.input.keyboard.addKey(
                Phaser.Keyboard[self.orbChars[orbIndex]]
            );

            self.addOrbFunctions[orb] = function () {
                self.addOrb(orb);
                console.log('On key added ' + orb + ' => ' + JSON.stringify(self.orbs));
            };
        });

        /**
         * @type {string[]}
         */
        self.orbs = [self.possibleOrbs[0], self.possibleOrbs[1], self.possibleOrbs[2]];

        /**
         *
         * @param {string} orb
         */
        self.addOrb = function (orb) {
            if (-1 !== self.possibleOrbs.indexOf(orb)) {
                self.orbs.push(orb);
            }

            if (self.orbs.length > 3) {
                self.orbs.shift();
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
                orbIndex = self.possibleOrbs.indexOf(orb);

                if (-1 !== orbIndex) {
                    result[orbIndex] = result[orbIndex] ? result[orbIndex] + 1 : 1;
                }

            });

            return result;
        };

        self.game.world.setBounds(0, 0, 1024, 768);
        self.space = self.game.add.tileSprite(0, 0, 1024, 768, 'space');
        self.planet = game.add.sprite(Math.round(1024/3*2 - 400/2), Math.round(768/2 - 400/2), 'planet');

        console.log(JSON.stringify(self.orbs));
        console.log(JSON.stringify(self.getModelInputs()));

        self.addOrb('love');
        console.log(JSON.stringify(self.orbs));
        console.log(JSON.stringify(self.getModelInputs()));

        console.log('game!');

    },

    update: function () {

        var self = this;



    },

    render: function () {



    }

};
