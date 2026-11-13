import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { About } from './pages/About';
import { Account } from './pages/Account';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { Contact } from './pages/Contact';
import { Demos } from './pages/Demos';
import { Home } from './pages/Home';
import { Industries } from './pages/Industries';
import { Pricing } from './pages/Pricing';
import { ResetPassword } from './pages/ResetPassword';
import { Services } from './pages/Services';
import { TrainingIndex } from './pages/TrainingIndex';
import { TrainingTrack } from './pages/TrainingTrack';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { VerifyEmail } from './pages/VerifyEmail';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="demos" element={<Demos />} />
        <Route path="contact" element={<Contact />} />
        <Route path="account" element={<Account />} />
        <Route path="about" element={<About />} />
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
