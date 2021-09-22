const functions = require("firebase-functions");
const yelp = require('yelp-fusion');
const yelpClient = yelp.client('api-key');
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.yelpSearch = functions.https.onRequest((req, res) =>  {

    yelpClient.search({
        term: 'pizza',
        latitude: 34.0522,
        longitude: -118.2437,
        sort_by: 'rating',
        // open_now: true
        open_at: 1632582000
    }).then(response => {
        console.log(response.jsonBody.businesses[0])
        res.send(response.jsonBody.businesses[0])
    })
})

exports.yelpAutoComplete = functions.https.onRequest((req, res) => {
    yelpClient.autocomplete({
        text: 'cof'
    }).then(response => {
        res.json(response.jsonBody)
    })
})

exports.yelpTripBuilder = functions.https.onRequest( async (req, res) => {
    console.log(req.body)
    // store request body in request object 
    // default to false for boolean checks
    const request = {
        cityName: req.body.cityName,
        coordinates: {
            lat: req.body.lat,
            lng: req.body.lng
        },
        autoBuild: req.body.autoBuild,
        time: {
            morning: req.body.morning,
            afternoon: req.body.afternoon,
            evening: req.body.evening,
        },
        transportation: req.body.transportation,
        activities: {
            coffee: req.body.coffee,
            food: req.body.food,
            shop: req.body.shop, 
            drink: req.body.drink, 
            thrifting: req.body.thrifting, 
            landmarks: req.body.landmarks, 
            zoos: req.body.zoos, 
            museums: req.body.museums,
            hiking: req.body.hiking
        }
    }
    console.log(request)
    // Configure the Unix times to use when calling Yelp API to make sure businesses are open on Saturday 
    // Morning = 9AM(0900), Afternoon = 12PM(1200), Evening, 7PM(1900)
    const morningDate = new Date(Date.now()); // create morning date object
    const afternoonDate = new Date(Date.now()); // create afternoon date object
    const eveningDate = new Date(Date.now()); // create evening date object

    // determine how many days to Saturday
    const day = morningDate.getUTCDay() // find what day of the week it is
    const dayToAdd = 6 - day // figure out how many days to get to Saturday
    const newDate = morningDate.getUTCDate() + dayToAdd // what calendar day to set
    const timeOffset = -420 * 60000 // offset in minutes * conversion rate to milliseconds
  
    // set dates to the next Saturday
    morningDate.setUTCDate(newDate) 
    afternoonDate.setUTCDate(newDate)
    eveningDate.setUTCDate(newDate)
    // set the correct hours for the time of day
    morningDate.setUTCHours(9)
    afternoonDate.setUTCHours(12)
    eveningDate.setUTCHours(19)
    // convert to the correct time based on timezone and convert to unix (ms) and then convert to unix in seconds
    const morningTime = ((morningDate.getTime() - timeOffset) - ((morningDate.getTime() - timeOffset)%1000))/1000
    const afternoonTime = ((afternoonDate.getTime() - timeOffset) - ((afternoonDate.getTime() - timeOffset)%1000))/1000
    const eveningTime = ((eveningDate.getTime() - timeOffset) - ((eveningDate.getTime() - timeOffset)%1000))/1000

    // Figure out time of the day to set for activities
    const coffee = request.activities.coffee ? (request.time.morning ? (morningTime) : (request.time.afternoon ? afternoonTime : eveningTime)) : null
    const drink = request.activities.drink ? (request.time.evening ? (eveningTime) : (request.time.afternoon ? afternoonTime : morningTime)) : null
    const shop = request.activities.shop ? (request.time.afternoon ? (afternoonTime) : (request.time.evening ? eveningTime : morningTime)) : null
    const thrifting = request.activities.thrifting ? (request.time.afternoon ? (afternoonTime) : (request.time.morning ? morningTime : eveningTime)) : null
    const landmarks = request.activities.landmarks ? (request.time.afternoon ? (afternoonTime) : (request.time.morning ? morningTime : eveningTime)) : null
    const zoos = request.activities.zoos ? (request.time.afternoon ? (afternoonTime) : (request.time.morning ? morningTime : eveningTime)) : null
    const museums = request.activities.museums ? (request.time.afternoon ? (afternoonTime) : (request.time.morning ? morningTime : eveningTime)) : null
    const hiking = request.activities.hiking ? (request.time.morning ? (morningTime) : (request.time.afternoon ? afternoonTime : eveningTime)) : null

    // Figure out what meals to suggest if food is on intinerary
    const breakfast = request.activities.food ? (request.time.morning ? (morningTime) : null) : null
    const lunch = request.activities.food ? (request.time.afternoon ? (afternoonTime) : null) : null
    const dinner = request.activities.food ? (request.time.evening ? (eveningTime) : null) : null

    const itineraryObject = {
        breakfast: breakfast,
        lunch: lunch,
        dinner: dinner,
        coffee: coffee,
        cocktails: drink,
        shop: shop,
        thrifting: thrifting,
        landmarks: landmarks,
        zoos: zoos,
        museums: museums,
        hiking: hiking
    }

    console.log(itineraryObject)
    var morningArray = []
    var afternoonArray = []
    var eveningArray = []

    // rate-limit API call with timer function
    const timer = ms => new Promise(res => setTimeout(res, ms))
    // iterate over activities to call Yelp API 
    const iterateObject = async (itineraryObject) => {
        for (const activity in itineraryObject) {
            if (itineraryObject[activity] !== null) {
                // Call Yelp API
                yelpClient.search({
                    term: activity,
                    latitude: request.coordinates.lat,
                    longitude: request.coordinates.lng,
                    sort_by: 'rating',                    
                    open_at: itineraryObject[activity]
                }).then(response => {             
                    // TODO -- add logic to select random business
                    const business = response.jsonBody.businesses[0] 
                    console.log(business)
                    // determine which array to add it to
                    switch (itineraryObject[activity]) {
                        case morningTime:
                            morningArray.push({
                                [activity]: business
                            })
                            break;
                        case afternoonTime: 
                            afternoonArray.push({
                                [activity]: business
                            })
                            break;
                        case eveningTime: 
                            eveningArray.push({
                                [activity]: business
                            })
                            break;
                        default:
                            break;
                    }
                })
            }                   
            // console.log(`${activity}: ${itineraryObject[activity]}`)
            // call timer to rate-limit API call
            await timer(1000);
        }
        const tripArray = [morningArray, afternoonArray, eveningArray]
        return tripArray
    }
    const responseObject = await iterateObject(itineraryObject)
    console.log(responseObject)
    res.send(responseObject)
})

// exports.time = functions.https.onRequest((req, res) => {
//     const timeOffset = -420 * 60000 // offset in minutes * conversion rate to milliseconds
//     const morningDate = new Date(Date.now());
//     const afternoonDate = new Date(Date.now());
//     const eveningDate = new Date(Date.now()); 
//     console.log(morningDate.toUTCString())
//     // find what day of the week it is
//     const day = morningDate.getUTCDay()
//     const dayToAdd = 6 - day // figure out how many days to get to Saturday
//     const newDate = morningDate.getUTCDate() + dayToAdd // what calendar day to set

//     morningDate.setUTCDate(newDate)
//     afternoonDate.setUTCDate(newDate)
//     eveningDate.setUTCDate(newDate)

    
//     console.log(morningDate.toUTCString())

//     morningDate.setUTCHours(9)
//     afternoonDate.setUTCHours(12)
//     eveningDate.setUTCHours(19)
//     console.log(morningDate.toUTCString())
//     console.log(morningDate.getTime() - timeOffset) // converts to Unix time in milliseconds and convert to timezone
//     console.log((morningDate.getTime()- (morningDate.getTime()%1000))/1000) // convert to seconds
//     console.log(afternoonDate.toUTCString())
//     console.log(eveningDate.toUTCString())
//     res.send('time api was called')
// })