require('dotenv').config();
var cheerio = require('cheerio');
var request = require('request');
var mongodb = require('mongodb');
var moment = require('moment');

moment.locale('sv');

var isHomeTeam = function (game) {
  return game.indexOf('KAIS') === 0;
};

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

var getResult = function (game, result) {
  var _isHomeTeam = isHomeTeam(game);
  var scoreArray = result.split('-');
  var homeScore = parseInt(scoreArray[0]);
  var awayScore = parseInt(scoreArray[1]);

  //temp fix

  if (((game.match(/KAIS/g) || []).length === 2)) {
    return 'good';
  }

  if (scoreArray.length === 1) {

  }

  if ((homeScore === awayScore)) {
    return '#000';
  }

  if (_isHomeTeam) {
    if (homeScore > awayScore) {
      return 'good';
    } else {
      return 'danger';
    }
  } else {
    if (awayScore > homeScore) {
      return 'good';
    } else {
      return 'danger';
    }
  }
};

var updateGames = function(games) {
  var MongoClient = mongodb.MongoClient;
  var url = process.env.DB_PATH;

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      //HURRAY!! We are connected. :)
      console.log('Connection established to', url);

      // Get the documents collection
      var collection = db.collection('results');
      games.forEach(function(game) {
        collection.update({
            'link': game.link
          },
          game,
          {
            'upsert': true
          }, function(err, results) {
            if (results.result.upserted) {
              postToSlack(game);
            }
          })
      });
    }
  });
};

var postToSlack = function (game) {
  var slack = require('slack-notify')(process.env.SLACK_WEBHOOK_URL);

  slack.send({
    channel: '#resultat-test',
    icon_url: 'https://s3-us-west-2.amazonaws.com/slack-files2/avatars/2015-10-20/12832034400_eb7bb6245b3959ddbad5_132.jpg',
    username: 'KAIS',
    'attachments': [
      {
        title: game.title,
        title_link: game.title_link,
        text: game.text,
        color: game.color,
        fields: [
          {
            title: 'Resultat',
            value: game.result,
            short: true
          },
          {
            title: 'Serie',
            value: game.league,
            short: true
          }
        ]
      }
    ]
  });
};

(function () {
  'use strict';
  var startDate = moment().subtract(2, 'day').format('YYYY-MM-DD');
  var endDate = moment().format('YYYY-MM-DD');
  var games = [];

  request('http://statistik.innebandy.se/ft.aspx?scr=clubfixturelist&ffid=18&feid=405&d='+ startDate +'&d2='+ endDate +'&sorting=2&w=4', function (error, response, body) {
    if (!error) {
      var $ = cheerio.load(body);
      var rows = $('.clCommonGrid tbody tr');

      rows.each(function () {
        if ($(this).find('td:nth-child(5)').text().length) {
          var league = $(this).find('td:nth-child(2)').text().replace('Pantamera', '');
          league = league.replace('Flickor', 'F').replace('Pojkar', 'P');
          league = league.replace(/klass.*\(/, '(').replace('klass', '');
          var _date = moment($(this).find('td:nth-child(1) span').text().trim());
          var value = capitalizeFirstLetter(_date.format('dddd DD/M [kl] HH:mm'));
          games.push({
            'title': $(this).find('td:nth-child(4)').text(),
            'title_link': 'http://statistik.innebandy.se/' + $(this).find('td:nth-child(3) a').attr('href'),
            'link': $(this).find('td:nth-child(3) a').attr('href'),
            'text': value,
            'result': $(this).find('td:nth-child(5)').text(),
            'league': league,
            'color': getResult($(this).find('td:nth-child(4)').text(), $(this).find('td:nth-child(5)').text())
          });
        } else {
          console.log('inga matcher');
        }
      });
      request('http://statistik.innebandy.se/ft.aspx?scr=clubfixturelist&ffid=18&feid=1323&d='+ startDate +'&d2='+ endDate +'&sorting=2&w=4', function (error, response, body) {
        if (!error) {
          var $ = cheerio.load(body);
          var rows = $('.clCommonGrid tbody tr');

          rows.each(function () {
            if ($(this).find('td:nth-child(5)').text().length) {
              var league = $(this).find('td:nth-child(2)').text().replace('Pantamera', '');
              league = league.replace('Flickor', 'F').replace('Pojkar', 'P');
              league = league.replace(/klass.*\(/, '(').replace('klass', '');
              var _date = moment($(this).find('td:nth-child(1) span').text().trim());
              var value = capitalizeFirstLetter(_date.format('dddd DD/M [kl] HH:mm'));
              games.push({
                'title': $(this).find('td:nth-child(4)').text(),
                'title_link': 'http://statistik.innebandy.se/' + $(this).find('td:nth-child(3) a').attr('href'),
                'link': $(this).find('td:nth-child(3) a').attr('href'),
                'text': value,
                'result': $(this).find('td:nth-child(5)').text(),
                'league': league,
                'color': getResult($(this).find('td:nth-child(4)').text(), $(this).find('td:nth-child(5)').text())
              });
            } else {
              console.log('inga matcher');
            }
          });
          updateGames(games);
        } else {
          console.log("We’ve encountered an error: " + error);
        }
      });
    } else {
      console.log("We’ve encountered an error: " + error);
    }
  });

})();

