module.exports.sockets = {
    onlyAllowOrigins: [
      "https://lostpawnetwork-100c261cba8a.herokuapp.com",
      "http://localhost:5173",
      "https://lostpawnetwork.netlify.app"
    ],
    beforeConnect: function(handshake, proceed) {
      // Example function to check allowed origins
      if (this.onlyAllowOrigins.includes(handshake.headers.origin)) {
        return proceed(undefined, true);
      }
      return proceed(new Error('Not allowed by CORS'), false);
    }
  };
  