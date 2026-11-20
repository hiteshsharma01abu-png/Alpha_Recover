import { company } from './content';

/** A paragraph, or a bullet list when it's an array. */
export type LegalBlock = string | string[];
export type LegalSection = { heading: string; body: LegalBlock[] };
export type LegalPageKey = 'privacy' | 'terms' | 'refund';
export type LegalPage = { title: string; intro: string; sections: LegalSection[] };

/** Shown on every legal page; change it whenever the text below changes. */
export const legalUpdated = { iso: '2026-11-20', label: '20 November 2026' };

/** Refund window in days (owner decision 2026-11-20, docs/PRD.md §6). */
export const refundWindowDays = 3;

const contactLine = `email ${company.email} or call/WhatsApp ${company.phoneDisplay} (${company.hours})`;

export const legalPages: Record<LegalPageKey, LegalPage> = {
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what personal information ${company.name} ("we", "us") collects through this website and the training portal, why we collect it, and the choices you have. We handle your information in line with India's Digital Personal Data Protection Act, 2023.`,
    sections: [
      {
        heading: 'What we collect',
        body: [
          [
            'Enquiries and callback requests: your name, phone number, email address (optional on callbacks) and your message.',
            'Student accounts: your name, email address, phone number, country, and the name you want printed on certificates. Your password is stored only in hashed form; we can never see it.',
            'Sign-in sessions: the device and browser you sign in from and its IP address, so you can see and sign out of your devices.',
            'Purchases: what you bought, the amount and the payment status. Card, UPI and bank details are entered on Razorpay\'s secure page and never reach our servers.',
            'Training activity: which lessons you open and your progress, so you can continue where you left off and receive certificates.',
          ],
        ],
      },
      {
        heading: 'How we use it',
        body: [
          [
            'To reply to your enquiry or call you back.',
            'To create and secure your account, give you access to the courses you bought, and issue certificates.',
            'To send account emails (email verification, password reset, receipts). We do not send marketing emails without your consent.',
            'To protect the site from spam and abuse, for example by limiting repeated attempts from the same network.',
            'To keep the financial records Indian tax law requires.',
          ],
        ],
      },
      {
        heading: 'Who we share it with',
        body: [
          'We never sell your personal information. We share it only with service providers that run parts of the service for us, and only what they need:',
          [
            'Email delivery, to send account and order emails.',
            'Cloudflare Turnstile, to check that forms are filled in by people, not bots.',
            'Razorpay, to process payments.',
            'Video hosting, to stream lessons to signed-in students.',
            'Our web hosting provider, which stores the website and database.',
          ],
          'We may also disclose information when the law requires it.',
        ],
      },
      {
        heading: 'Cookies and browser storage',
        body: [
          'We use one sign-in cookie to keep you logged in, and your browser\'s storage for small preferences such as the admin colour theme. We do not use advertising or tracking cookies.',
        ],
      },
      {
        heading: 'How we protect it',
        body: [
          'Connections to the site are encrypted, passwords are hashed, staff can only see the areas their role needs, and staff actions are logged.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'We keep account information while your account is open, and enquiries for as long as needed to follow up. Expired sign-in sessions are deleted automatically. Purchase and invoice records are kept for at least 8 years, as Indian tax law requires.',
        ],
      },
      {
        heading: 'Your choices and rights',
        body: [
          `You can view and update your profile and sign out of devices from Account settings. To get a copy of your information, correct it, or delete your account, ${contactLine}. We reply within 7 working days. Deleting an account ends access to purchased courses; records we must keep by law are retained.`,
        ],
      },
      {
        heading: 'Children',
        body: ['Our courses are meant for adults. Anyone under 18 should use the site with a parent or guardian\'s consent.'],
      },
      {
        heading: 'Changes and contact',
        body: [
          `If we change this policy, we update the date at the top of this page. For privacy questions or complaints, ${contactLine}, or write to ${company.addressFull}.`,
        ],
      },
    ],
  },

  terms: {
    title: 'Terms & Conditions',
    intro: `These terms apply when you use this website, create an account, buy a course, or ask ${company.name} ("we", "us") for a data recovery service. By using the site you agree to them.`,
    sections: [
      {
        heading: 'Accounts',
        body: [
          [
            'Give accurate details when you register, and keep your password private.',
            'An account is for one person. Sharing it, or reselling access, is not allowed.',
            'For security, an account can be signed in on a limited number of devices at the same time. Signing in on another device may sign out an older one.',
            'We may suspend accounts that break these terms, for example by sharing course content.',
          ],
        ],
      },
      {
        heading: 'Courses, prices and payment',
        body: [
          [
            'Prices are shown in Indian rupees (₹) and are charged once; there is no subscription.',
            'Payments are processed by Razorpay. Your purchase is confirmed when the payment succeeds.',
            '"Lifetime access" means you can use the courses in your plan for as long as we run the training portal, including updates we add to those courses.',
            'Sale prices apply only during the period shown on the site.',
          ],
        ],
      },
      {
        heading: 'Delivery',
        body: [
          `Courses are delivered online; nothing is shipped. Access is added to your account as soon as your payment is confirmed, usually within minutes, and we email you a confirmation. If you can't see your course within 24 hours of paying, ${contactLine}.`,
        ],
      },
      {
        heading: 'Refunds',
        body: [`You can ask for a full refund within ${refundWindowDays} days of purchase, for any reason. Details are in our Refund & Cancellation Policy.`],
      },
      {
        heading: 'Course content',
        body: [
          'All videos, notes and materials belong to us or our licensors. You may use them for your own learning only. Downloading, recording, copying, sharing or reselling them is not allowed.',
          'Our training teaches professional recovery techniques. Use them only on devices you own or are authorised to work on.',
        ],
      },
      {
        heading: 'Certificates',
        body: [
          'Certificates are issued when you meet the course requirements. Anyone can check a certificate on our Verify Certificate page. We may revoke a certificate obtained by fraud or account sharing.',
        ],
      },
      {
        heading: 'Data recovery services',
        body: [
          'Recovery jobs are quoted case by case after diagnosis. Recovery depends on the condition of the device, so we cannot guarantee that data can be recovered. We handle client devices and data confidentially.',
        ],
      },
      {
        heading: 'Limitation of liability',
        body: [
          'We provide the training and the website with reasonable care, but we are not liable for indirect losses, or for loss of data or damage caused by applying techniques from the courses. Our total liability for a purchase is limited to the amount you paid for it.',
        ],
      },
      {
        heading: 'Governing law',
        body: ['These terms are governed by the laws of India. Disputes are subject to the courts of Ahmedabad, Gujarat.'],
      },
      {
        heading: 'Changes and contact',
        body: [`We may update these terms; the date at the top of this page shows the latest version. Questions: ${contactLine}.`],
      },
    ],
  },

  refund: {
    title: 'Refund & Cancellation Policy',
    intro: `We want you to be sure about your course. If it isn't right for you, you can get your money back within ${refundWindowDays} days.`,
    sections: [
      {
        heading: `${refundWindowDays}-day refund, any reason`,
        body: [
          [
            `Ask within ${refundWindowDays} days of your purchase date and we refund the full amount. You don't need to give a reason.`,
            'Your access to the courses in that purchase ends when the refund is approved.',
            'Each purchase can be refunded once.',
          ],
        ],
      },
      {
        heading: 'How to ask for a refund',
        body: [`From the email address on your account, ${contactLine}. Include your name and the date of purchase or the payment ID from your receipt.`],
      },
      {
        heading: 'When you get your money',
        body: [
          'We approve refund requests within 2 working days. The money goes back to the original payment method (card, UPI, net banking or wallet); your bank usually shows it within 5–7 working days after approval.',
        ],
      },
      {
        heading: `After ${refundWindowDays} days`,
        body: [
          `Purchases are not refundable after ${refundWindowDays} days, except in these cases, which we always refund:`,
          [
            'You were charged twice for the same purchase.',
            'Money was taken but the purchase failed and you did not get access.',
            'We stop offering a course before you could access it.',
          ],
        ],
      },
      {
        heading: 'Cancellation',
        body: [
          'Courses are a one-time purchase, not a subscription, so there is nothing to cancel later and you will not be charged again. To cancel a purchase you just made, ask for a refund as described above.',
          'For data recovery service jobs, refunds and cancellation follow the written quote for that job.',
        ],
      },
    ],
  },
};
