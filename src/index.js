import { OAuthStrategy, InternalOAuthError } from 'passport-oauth';

/**
 * `TwitterTokenStrategy` constructor.
 *
 * The Twitter authentication strategy authenticates requests by delegating to
 * Twitter using the OAuth protocol.
 *
 * Applications must supply a `verify` callback which accepts a `token`,
 * `tokenSecret` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `consumerKey`     identifies client to Twitter
 *   - `consumerSecret`  secret used to establish ownership of the consumer key
 *
 * Examples:
 *
 *     passport.use(new TwitterTokenStrategy({
 *         consumerKey: '123-456-789',
 *         consumerSecret: 'shhh-its-a-secret'
 *       },
 *       function(token, tokenSecret, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
export default class TwitterTokenStrategy extends OAuthStrategy {
  constructor(_options, _verify) {
    let verify = _verify;
    let options = Object.assign({
      requestTokenURL: 'https://api.twitter.com/oauth/request_token',
      accessTokenURL: 'https://api.twitter.com/oauth/access_token',
      userAuthorizationURL: 'https://api.twitter.com/oauth/authenticate',
      sessionKey: 'oauth:twitter'
    }, _options);

    super(options, verify);

    this.name = 'twitter-token';
    this._skipExtendedUserProfile = (options.skipExtendedUserProfile === undefined) ? false : options.skipExtendedUserProfile;
  }

  static lookup(obj, field) {
    if (!obj) return null;

    let chain = field.split(']').join('').split('[');

    for (let i = 0, len = chain.length; i < len; i++) {
      let prop = obj[chain[i]];

      if (typeof(prop) === 'undefined') return null;
      if (typeof(prop) !== 'object') return prop;

      obj = prop;
    }

    return null;
  }

  /**
   * Authenticate request by delegating to Twitter using OAuth.
   *
   * @param {Object} req
   * @api protected
   */
  authenticate(req, options) {
    // When a user denies authorization on Twitter, they are presented with a link
    // to return to the application in the following format (where xxx is the
    // value of the request token):
    //
    //     http://www.example.com/auth/twitter/callback?denied=xxx
    //
    // Following the link back to the application is interpreted as an
    // authentication failure.
    if (req.query && req.query.denied) return this.fail();

    let token = lookup(req.body, 'oauth_token') || lookup(req.query, 'oauth_token');
    let tokenSecret = lookup(req.body, 'oauth_token_secret') || lookup(req.query, 'oauth_token_secret');
    let userId = lookup(req.body, 'user_id') || lookup(req.query, 'user_id');
    let params = {user_id: userId};

    if (!token) return this.fail({message: `You should provide oauth_token`});

    this._loadUserProfile(token, tokenSecret, params, function (error, profile) {
      if (error) return this.error(error);

      const verified = (error, user, info) => {
        if (error) return this.error(error);
        if (!user) return this.fail(info);

        return this.success(user, info);
      };

      if (this._passReqToCallback) {
        this._verify(req, token, tokenSecret, profile, verified);
      } else {
        this._verify(token, tokenSecret, profile, verified);
      }
    });
  }

  /**
   * Retrieve user profile from Twitter.
   *
   * This function constructs a normalized profile, with the following properties:
   *
   *   - `id`        (equivalent to `user_id`)
   *   - `username`  (equivalent to `screen_name`)
   *
   * Note that because Twitter supplies basic profile information in query
   * parameters when redirecting back to the application, loading of Twitter
   * profiles *does not* result in an additional HTTP request, when the
   * `skipExtendedUserProfile` is enabled.
   *
   * @param {String} token
   * @param {String} tokenSecret
   * @param {Object} params
   * @param {Function} done
   * @api protected
   */
  userProfile(token, tokenSecret, params, done) {
    if (!this._skipExtendedUserProfile) {
      this._oauth.get('https://api.twitter.com/1.1/users/show.json?user_id=' + params.user_id, token, tokenSecret, function (err, body, res) {
        if (err) {
          return done(new InternalOAuthError('failed to fetch user profile', err));
        }

        try {
          let json = JSON.parse(body);

          let profile = {provider: 'twitter'};
          profile.id = json.id;
          profile.username = json.screen_name;
          profile.displayName = json.name;
          profile.photos = [{value: json.profile_image_url_https}];

          profile._raw = body;
          profile._json = json;

          done(null, profile);
        } catch (e) {
          done(e);
        }
      });
    } else {
      let profile = {provider: 'twitter'};
      profile.id = params.user_id;
      profile.username = params.screen_name;

      done(null, profile);
    }
  }

  /**
   * Return extra Twitter-specific parameters to be included in the user
   * authorization request.
   *
   * @param {Object} options
   * @return {Object}
   * @api protected
   */
  userAuthorizationParams(options) {
    let params = {};
    if (options.forceLogin) {
      params['force_login'] = options.forceLogin;
    }
    if (options.screenName) {
      params['screen_name'] = options.screenName;
    }
    return params;
  }
}
