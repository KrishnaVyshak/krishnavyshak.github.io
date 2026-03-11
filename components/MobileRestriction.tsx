"use client";

import React from 'react';

const MobileRestriction = () => {
  return (
    <div className="mobile-restriction">
      <div className="mobile-restriction-content">
        <div className="warning-icon">▲</div>
        <h1>SYSTEM NOTICE</h1>
        <p>
          KRISHNAVYSHAK PORTFOLIO<br />
          [ACCESS: DESKTOP ONLY]<br />
          STATUS: RESTRICTED
        </p>
        <div className="ascii-decoration">
          +-----------------------+<br />
          |  PLEASE SWITCH TO A   |<br />
          |  DESKTOP ENVIRONMENT  |<br />
          |      TO CONTINUE      |<br />
          +-----------------------+<br />
          [ERROR_CODE: MOBILE_DEVICE]
        </div>
      </div>
    </div>
  );
};

export default MobileRestriction;
