import { CONTACT } from './content';
import { ButtonLink, Container } from './primitives';

export function AccessCta() {
  return (
    <section className="bg-white pb-14 md:pb-18 lg:pb-24">
      <Container>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[22px] border border-[#eaecf0] bg-gray-50 p-5 md:p-7">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <h2 className="text-[21px] leading-tight font-extrabold">Need access for your unit?</h2>
            <p className="text-[15px] leading-[1.55] text-pretty text-gray-600">
              The DRRM-H office adds ERT members.
            </p>
          </div>
          <div className="flex flex-[1_1_100%] flex-col md:flex-none">
            <ButtonLink href={`mailto:${CONTACT.email}`} variant="outline" fullWidth>
              Email the DRRM-H Center
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
