import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { About } from './pages/About';
import { Account } from './pages/Account';
import { AccountSettings } from './pages/AccountSettings';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { CheckoutResult } from './pages/CheckoutResult';
import { Contact } from './pages/Contact';
import { Dashboard } from './pages/Dashboard';
import { Demos } from './pages/Demos';
import { Home } from './pages/Home';
import { Industries } from './pages/Industries';
import { LegalPage } from './pages/Legal';
import { LessonPlayer } from './pages/LessonPlayer';
import { Pricing } from './pages/Pricing';
import { ResetPassword } from './pages/ResetPassword';
import { Services } from './pages/Services';
import { TrainingIndex } from './pages/TrainingIndex';
import { TrainingTrack } from './pages/TrainingTrack';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { VerifyEmail } from './pages/VerifyEmail';

// The admin panel is a separate chunk: visitors never download it (docs/admin/ARCHITECTURE.md §2).
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route
        path="admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="checkout/success" element={<CheckoutResult outcome="success" />} />
        <Route path="checkout/failed" element={<CheckoutResult outcome="failed" />} />
        <Route path="demos" element={<Demos />} />
        <Route path="contact" element={<Contact />} />
        <Route path="account" element={<Account />} />
        <Route path="account/settings" element={<AccountSettings />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="learn/:courseSlug/:moduleSlug/:lessonSlug" element={<LessonPlayer />} />
        <Route path="about" element={<About />} />
        <Route path="privacy-policy" element={<LegalPage page="privacy" />} />
        <Route path="terms" element={<LegalPage page="terms" />} />
        <Route path="refund-policy" element={<LegalPage page="refund" />} />
        <Route path="services" element={<Services />} />
        <Route path="industries" element={<Industries />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogPost />} />
        <Route path="verify-certificate" element={<VerifyCertificate />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="training" element={<TrainingIndex />} />
        <Route path="training/:trackId" element={<TrainingTrack />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
