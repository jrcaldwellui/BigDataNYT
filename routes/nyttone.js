var express = require('express');
var router = express.Router();

var hol1 = 0;
var hol2 = 0;

router.get('/nyttone*', function (req, res) {
    hol1 = req;
    hol2 = res;
    callthis(req.query.searchterm, parseInt(req.query.begindate), parseInt(req.query.enddate));
});

var goodCode=0;
function onFinish() {
    goodCode++;
    if (goodCode > 2)
    {
        console.log("Executing good code.");
        goodCode = 0;
        hol2.render('nyttone', { articleName: articleName, datePublished: datePublished, score: score, articles: articles, beginDate: hol1.query.begindate, endDate: hol1.query.enddate });
   }
  
}

router.get('/nyttone', function (req, res) {
    res.render('nyttone');
});


var request = require('request');
var sentiment = require('sentiment');
var RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 1000);
var sentimentResponses = [];
var forbidden = 0;
var numberOfTimeouts = 0;

var articles = 0;
var articleName = [];
var datePublished = [];
var score = [];


function callthis(q, begin_date, end_date,callback) {
    articles = 0;
    var differenceInDates = end_date - begin_date;
    begin_date *= 10000;
    begin_date += 101;
    end_date *= 10000;
    end_date += 1231;

    if (differenceInDates >= 3) {
        differenceInDates /= 3;
        differenceInDates = differenceInDates | 0;
        differenceInDates *= 10000;

        getScores(q, begin_date, begin_date + differenceInDates);
        getScores(q, begin_date + differenceInDates, begin_date + 2 * differenceInDates);
        getScores(q, begin_date + 2 * differenceInDates, end_date);

    
    } else {

        getScores(q, begin_date, end_date);
    }
}

function getScores(q, begin_date, end_date) {
    do {
        limiter.removeTokens(1, function () {
            request.get({
                url: "https://api.nytimes.com/svc/search/v2/articlesearch.json",
                qs: {
                    'api-key': "bc500cd222c46649f60f333c6523236",
                    'q': q,
                    'fq': "type_of_material:(\"Addendum\", \"An Analysis\", \"Article\", \"Biography\", \"Brief\", \"Chronology\", \"Column\", \"Economic Analysis\", \"Editorial\", \"First Chapter\", \"Interview\", \"Military Analysis\", \"News\", \"News Analysis\", \"Special Report\", \"Summary\", \"Text\")",
                    'begin_date': begin_date,
                    'end_date': end_date,
                    'fl': "lead_paragraph,abstract,headline,pub_date,type_of_material"
                },
            }, function (err, response, body) {

                if (body.charAt(0) == '<') {
                    forbidden = true;
                    numberOfTimeouts++;
                    return true;
                } else {
                    forbidden = false;
                }

                body = JSON.parse(body);

                //console.log(body);
	
				if (body == "{ message: 'API rate limit exceeded' }") {
					onFinish();
					return true;
				}
				
                if (!body.response) {
					onFinish();
					return true;
                } 
				
				
				if (body.response.meta.hits == 0) {
                    onFinish();
					return true;
                }
				
                var result;
                var totalScore;
                var totalWords;
				
				var loopamount = body.response.meta.hits < 10 ? body.response.meta.hits : 10;
                
				for (var i = 0; i < loopamount; i++) {
                    totalScore = 0;
                    totalWords = 0;
                    if (body.response.docs[i] && body.response.docs[i].headline.main) {
                        result = sentiment(body.response.docs[i].headline.main);
                        totalScore += result.score;
                        totalWords += WordCount(body.response.docs[i].headline.main);
                    }
                    
                    if (body.response.docs[i].lead_paragraph) {
                        result = sentiment(body.response.docs[i].lead_paragraph);
                        totalScore += result.score;
                        totalWords += WordCount(body.response.docs[i].lead_paragraph);
                    }

                    if (body.response.docs[i].abstract) {
                        result = sentiment(body.response.docs[i].abstract);
                        totalScore += result.score;
                        totalWords += WordCount(body.response.docs[i].abstract);
                    }

                    totalWords += 10;
                    totalScore /= totalWords;
                    if (totalScore < -.07 || totalScore > .07) {
                        articleName[articles] = body.response.docs[i].headline.main;
                        datePublished[articles] = body.response.docs[i].pub_date;
                        // only first 10 characters of datePublished necessary
                        datePublished[articles] = datePublished[articles].substring(0, 10);
                        score[articles] = totalScore;
                        articles++;
                    }
                }

				/*
                for (i = 0; i < articles; i++) {
                    console.log("name:%s\t\tdate published:%s\t\tscore:%d\n", articleName[i], datePublished[i], score[i]);
                }
				*/
                onFinish();
            })
        });
    } while (forbidden && numberOfTimeouts < 5);
    
}

function WordCount(str) {
    return str.split(" ").length;
}


module.exports = router;
