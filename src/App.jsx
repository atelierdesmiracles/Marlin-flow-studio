import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClientInstance } from "@/lib/query-client"
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { ProjectProvider } from "@/lib/projectStore";
import { I18nProvider } from "@/lib/i18n";
import Home from "@/pages/Home";

function App() {
  return (
    <AppErrorBoundary>
    <QueryClientProvider client={queryClientInstance}>
      <I18nProvider>
        <ProjectProvider>
          <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
          </Router>
          <Toaster />
        </ProjectProvider>
      </I18nProvider>
    </QueryClientProvider>
    </AppErrorBoundary>
  )
}

export default App
