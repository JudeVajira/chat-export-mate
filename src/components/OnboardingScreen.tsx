import { ArrowRight, FileText, ShieldCheck, Smartphone } from "lucide-react";

export function OnboardingScreen({
  appName,
  onStart,
  spenlioEdition,
}: {
  appName: string;
  onStart: () => void;
  spenlioEdition: boolean;
}) {
  const promises = spenlioEdition
    ? [
        {
          icon: Smartphone,
          title: "Reads a local iPhone backup",
          detail: "Back up your iPhone to this computer with Apple Devices or iTunes, and Spenlio SMS Exporter reads the messages from that backup.",
        },
        {
          icon: FileText,
          title: "Creates a Spenlio-ready CSV",
          detail: "Business SMS senders become spreadsheet rows with sender, date, message ID, and text — ready to import.",
        },
        {
          icon: ShieldCheck,
          title: "Nothing leaves this computer",
          detail: "Your messages are read locally and saved locally. There is no account, no cloud, and no upload.",
        },
      ]
    : [
        {
          icon: Smartphone,
          title: "Works from an iPhone backup",
          detail: `Back up your iPhone to this computer with Apple Devices or iTunes, and ${appName} reads the messages from that backup.`,
        },
        {
          icon: FileText,
          title: "Makes files you can keep",
          detail: "Save conversations as web pages you can browse, plain text you can archive, or a spreadsheet you can search.",
        },
        {
          icon: ShieldCheck,
          title: "Nothing leaves this computer",
          detail: "Your messages are read locally and saved locally. There is no account, no cloud, and no upload.",
        },
      ];

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>{spenlioEdition ? "Your SMS, ready for Spenlio." : "Your messages, saved for good."}</h1>
        <p className="onboarding-lede">
          {spenlioEdition
            ? "Spenlio SMS Exporter turns an iPhone backup on this computer into a finance SMS spreadsheet."
            : `${appName} turns an iPhone backup on this computer into files you can read, search, and keep.`}
        </p>

        <div className="onboarding-promises">
          {promises.map((promise) => {
            const Icon = promise.icon;
            return (
              <div className="onboarding-promise" key={promise.title}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{promise.title}</strong>
                  <p>{promise.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button autoFocus className="button button--primary button--large" onClick={onStart} type="button">
          Get started
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
