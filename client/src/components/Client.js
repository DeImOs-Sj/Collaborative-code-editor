import React from 'react';
import Avatar from 'react-avatar';

function Client({ username }) {

  return (
    <div className="d-flex align-items-center mb-3">
      <Avatar name={username.toString()} size={40} round="14px" className="text-sm" />
      <span className='mx-1'>{username.toString()}</span>
    </div>
  );
}

export default Client;
