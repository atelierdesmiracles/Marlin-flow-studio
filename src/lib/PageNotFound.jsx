import React from 'react';
import { useI18n } from '@/lib/i18n';
import { Link } from 'react-router-dom';

export default function PageNotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="text-6xl font-bold tracking-tight mb-3">404</div>
        <h1 className="text-lg font-semibold mb-2">{t("errors.notFound")}</h1>
        <p className="text-sm text-muted-foreground mb-5">{t("errors.notFoundDesc")}</p>
        <Link to="/" className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">{t("errors.backToStudio")}</Link>
      </div>
    </div>
  );
}
