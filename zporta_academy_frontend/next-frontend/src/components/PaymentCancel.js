import React from "react";
import Link from 'next/link';

export default function PaymentCancel() {
  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 20 }}>
      <h2>Payment Cancelled</h2>
      <p>Your payment was cancelled. You can try enrolling again or return to your courses.</p>

      {/* MyCourses is not in Next. Point to a real Next route. */}
      <Link href="/enrolled-courses">
        Back to Enrolled Courses
      </Link>
    </div>
  );
}
