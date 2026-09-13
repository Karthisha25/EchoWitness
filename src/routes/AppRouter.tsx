import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { ROUTES } from '@/routes/paths';
import { EntryReviewScreen } from '@/screens/EntryReview/EntryReviewScreen';
import { GuidedInterviewScreen } from '@/screens/GuidedInterview/GuidedInterviewScreen';
import { HistoryScreen } from '@/screens/History/HistoryScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { LegalMappingViewScreen } from '@/screens/LegalMappingView/LegalMappingViewScreen';
import { LiveCaptureScreen } from '@/screens/LiveCapture/LiveCaptureScreen';
import { LoginScreen } from '@/screens/Login/LoginScreen';
import { ReportPreviewScreen } from '@/screens/ReportPreview/ReportPreviewScreen';

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginScreen />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.home} element={<HomeScreen />} />
          <Route path={ROUTES.history} element={<HistoryScreen />} />
          <Route path="/incidents/:incidentId/capture" element={<LiveCaptureScreen />} />
          <Route path="/incidents/:incidentId/interview" element={<GuidedInterviewScreen />} />
          <Route path="/incidents/:incidentId/review" element={<EntryReviewScreen />} />
          <Route path="/incidents/:incidentId/legal" element={<LegalMappingViewScreen />} />
          <Route path="/incidents/:incidentId/report" element={<ReportPreviewScreen />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
