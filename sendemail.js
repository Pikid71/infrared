const emailjs = require('@emailjs/nodejs');
const emjprv = process.env.EMAILJS_PRIVATE;
const emjpub = process.env.EMAILJS_PUBLIC;
const template_id = 'template_infrared';
const service_id = 'blackchat_conformation_2';
function send(username, code, user_email) {
    console.log(username, code, user_email)
    emailjs.send(
        service_id,
        template_id,
        {
            username,
            code,
            user_email
        },
        {
            publicKey: emjpub,
            privateKey: emjprv
        }
    )
    .then((res) => {
        console.log('Sent', res.status, res.text);
    })
    .catch((err) => {
        console.log('Error', err)
    })
}
console.log('Emailer Imported Successfully')
module.exports = { send }