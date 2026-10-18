const { MongoClient } = require('mongodb');
require('dotenv').config()

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)
function log(ifff) {
    console.log(ifff)
}
async function createUser(usrnm, pass, eml, xp, gold, rank) {
    try {
        await client.connect()
        const db = client.db('infrared_test')
        const users = db.collection('users')
        await users.insertOne({
            username: usrnm,
            password: pass,
            email: eml,
            xp,
            gold,
            rank,
            level: Math.floor(Math.sqrt(xp)),
            rl_username: usrnm.toLowerCase(),            
        })
        await users.deleteMany({ rl_username: 'pi_kid71'})
        console.log(await users.findOne({ rl_username: 'pi_kid71' }))
    } catch (error) {
        log(error)
    } finally {
        await client.close()
    }
}

createUser('Pi_Kd71', 'pass123', 'me@goo.gle', 102, 21, 'owner')