const keys = require('../config/keys');
const mongoose = require('mongoose');
const stripe = require('stripe')(keys.stripeSecretKey);
const requireLogin = require('../middlewares/requireLogin');
const Order = mongoose.model('orders');
const Cart = require('../models/Cart');
const Mailer = require('../services/mailer');

module.exports = app => {
  app.post('/api/stripe', async (req, res) => {
    const charge = await stripe.charges
      .create({
        amount: req.body.amount * 100,
        currency: 'eur',
        description: 'New Order',
        source: req.body.token.id
      })
      .then(
        result => {
          const orderId =
            'order' + new Date().getTime() + 't' +  Math.floor(Math.random() * 1000 + 1);
          const order = new Order({
            ...result,
            orderId,
            customerEmail: req.body.token.email,
            status: 'NEW',
            cart: req.session.cart,
            _user: req.user.id,
            dateAdd: Date.now()
          });
          order.save();

          const mailer = new Mailer(
            req.session.cart,
            req.body.token.email,
            orderId
          );
          mailer.send();

          const cart = new Cart({});
          req.session.cart = cart;
          if (req.user) {
            req.user.cart = cart;
            req.user.order = [...req.user.order, order];
            req.user.save();
          }

          res.send({ order, cart });
        },
        err => {
          switch (err.type) {
            case 'StripeCardError':
              // A declined card error
              res.send(err);
              break;
            case 'RateLimitError':
              // Too many requests made to the API too quickly
              res.send(err);
              break;
            case 'StripeInvalidRequestError':
              // Invalid parameters were supplied to Stripe's API
              res.send(err);
              break;
            case 'StripeAPIError':
              // An error occurred internally with Stripe's API
              res.send(err);
              break;
            case 'StripeConnectionError':
              // Some kind of error occurred during the HTTPS communication
              res.send(err);
              break;
            case 'StripeAuthenticationError':
              // You probably used an incorrect API key
              res.send(err);
              break;
            default:
              // Handle any other types of unexpected errors
              res.send(err);
              break;
          }
        }
      );
  });
};
