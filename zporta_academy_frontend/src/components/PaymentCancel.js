import React from "react";
import { Link } from "react-router-dom";
import "./PaymentCancel.css"; // Optional: add your styles here

const PaymentCancel = () => {
  return (
    <div className="payment-cancel-container">
      <h2>Payment Cancelled</h2>
      <p>Your payment was cancelled. You can try enrolling again or return to your courses.</p>
      <Link to="/my-courses">
        <button className="back-button">Back to My Courses</button>
      </Link>
    </div>
  );
};

export default PaymentCancel;
