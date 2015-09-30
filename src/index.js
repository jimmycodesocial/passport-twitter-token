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
    let options = _options || {};
    let verify = _verify;

    options.requestTokenURL = options.requestTokenURL || 'https://api.twitter.com/oauth/request_token';
    options.accessTokenURL = options.accessTokenURL || 'https://api.twitter.com/oauth/access_token';
    options.userAuthorizationURL = options.userAuthorizationURL || 'https://api.twitter.com/oauth/authenticate';
    options.sessionKey = options.sessionKey || 'oauth:twitter';

    super(options, verify);

    this.name = 'twitter-token';
    this._oauthTokenField = options.oauthTokenField || 'oauth_token';
    this._oauthTokenSecretField = options.oauthTokenSecretField || 'oauth_token_secret';
    this._userIdField = options.userIdField || 'user_id';
  }

  /**
   * Authenticate request by delegating to Twitter using OAuth.
   *
   * @param {Object} req
   * @api protected
   */
  authenticate(req, options) {
    // Following the link back to the application is interpreted as an authentication failure
    if (req.query && req.query.denied) return this.fail();

    let token = (req.body && req.body[this._oauthTokenField]) || (req.query && req.query[this._oauthTokenField]);
    let tokenSecret = (req.body && req.body[this._oauthTokenSecretField]) || (req.query && req.query[this._oauthTokenSecretField]);
    let userId = (req.body && req.body[this._userIdField]) || (req.query && req.query[this._userIdField]);

    if (!token) return this.fail({message: `You should provide ${this._oauthTokenField} and ${this._oauthTokenSecretField}`});

    this._loadUserProfile(token, tokenSecret, {user_id: userId}, (error, profile) => {
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
    this._oauth.get(`https://api.twitter.com/1.1/users/show.json?user_id=${params.user_id}`, token, tokenSecret, (error, body, res) => {
      if (error) return done(new InternalOAuthError('Failed to fetch user profile', error));

      try {
        let json = JSON.parse(body);
        let profile = {
          provider: 'twitter',
          id: json.id,
          username: json.screen_name,
          displayName: json.name,
          name: {
            familyName: '',
            givenName: '',
            middleName: ''
          },
          emails: [{value: ''}],
          photos: [{value: json.profile_image_url_https}],
          _raw: body,
          _json: json
        };

        done(null, profile);
      } catch (e) {
        done(e);
      }
    });
  }
}
