/**
 * Copyright © 2018 Elastic Path Software Inc. All rights reserved.
 *
 * This is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this license. If not, see
 *
 *     https://www.gnu.org/licenses/
 *
 *
 */

import React from 'react';
import ReactRouterPropTypes from 'react-router-prop-types';
import { loginRegistered } from '../utils/AuthService';
import './ChatbotAuthenticationPage.less';

class ChatbotAuthPage extends React.Component {
  static propTypes = {
    location: ReactRouterPropTypes.location.isRequired,
  }

  constructor(props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    const redirectUri = params.get('redirect_uri');
    this.state = {
      email: '',
      password: '',
      isLogging: false,
      failedLogin: '',
      succeededLogin: '',
      redirectUri,
    };

    this.setPassword = this.setPassword.bind(this);
    this.setEmail = this.setEmail.bind(this);
    this.login = this.login.bind(this);
  }

  componentDidMount() {
  }

  setEmail(event) {
    this.setState({ email: event.target.value });
  }

  setPassword(event) {
    this.setState({ password: event.target.value });
  }

  login() {
    this.setState({
      isLogging: true,
      failedLogin: '',
      succeededLogin: '',
    });

    const { email, password, redirectUri } = this.state;

    loginRegistered(email, password).then((response) => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(response)) {
        this.setState({
          failedLogin: 'The email address or the password is incorrect',
          succeededLogin: '',
          isLogging: false,
        });
      } else {
        this.setState({
          failedLogin: '',
          succeededLogin: 'You successfully logged in!',
          isLogging: false,
        });
        setTimeout(() => {
          window.location = `${redirectUri}&authorization_code=${response}`;
        }, 5000);
      }
    }).catch(() => {
      this.setState({
        failedLogin: 'An unexpected error occurred',
        succeededLogin: '',
        isLogging: false,
      });
    });
  }

  render() {
    const { isLogging, failedLogin, succeededLogin } = this.state;
    return (
      <div className="col-md-12 col-lg-8 offset-lg-2 col-xl-6 offset-xl-3">
        <div className="facebook-auth-form">
          <div className="login-form">
            <div className="main-div">
              <div className="panel">
                <h2>Chat login</h2>
                <p>Please enter your email and password</p>
              </div>
              <div className="form-group">
                <input type="email" className="form-control" id="inputEmail" placeholder="Email Address" onChange={this.setEmail} />
              </div>
              <div className="form-group">
                <input type="password" className="form-control" id="inputPassword" placeholder="Password" onChange={this.setPassword} />
              </div>
              <div className="forgot">
                <a href="reset.html">Forgot password?</a>
              </div>
              <button type="submit" className="btn btn-primary" onClick={this.login}>Login</button>
              <div className="panel margin-top-30">
                <div className={isLogging ? 'display-block' : 'display-none'}>
                  <h1 className="color-blue">
                    <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate" />
                  </h1>
                </div>
                <div className={succeededLogin ? 'display-block' : 'display-none'}>
                  <h1 className="color-green">
                    <span className="glyphicon glyphicon-ok-circle" />
                    &nbsp;&nbsp; {succeededLogin}
                  </h1>
                </div>
                <div className={failedLogin ? 'display-block' : 'display-none'}>
                  <h1 className="color-red">
                    <span className="glyphicon glyphicon-remove-circle" />
                    &nbsp;&nbsp; {failedLogin}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ChatbotAuthPage;
