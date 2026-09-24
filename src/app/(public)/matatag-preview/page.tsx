import { MatatagForm } from '@/components/matatag/matatag-form';
import { Suspense } from 'react';

export default function MatatagPreviewPage() {
  return (
    <Suspense fallback={<p>Loading preview...</p>}>
      <MatatagForm />
      <script
        dangerouslySetInnerHTML={{
          __html: `const previewTimer = setInterval(() => {
            [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Not now')?.click();
            const sectionButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Crisis Plans/Emergency Preparedness'));
            if (sectionButton && document.querySelector('h2')?.textContent === 'Assessment details') sectionButton.click();
            if (document.querySelector('h2')?.textContent?.includes('Crisis Plans')) clearInterval(previewTimer);
          }, 500);
          setTimeout(() => {
            const overflow = [...document.querySelectorAll('*')]
              .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map((element) => [element.tagName, element.className, Math.round(element.getBoundingClientRect().right)]);
            document.documentElement.dataset.previewMetrics = JSON.stringify({ innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow });
          }, 2500);`,
        }}
      />
    </Suspense>
  );
}
