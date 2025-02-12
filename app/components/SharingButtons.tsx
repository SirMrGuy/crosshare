import { mix } from 'color2k';
import { ReactNode } from 'react';
import {
  FaTwitter,
  FaFacebook,
  FaEnvelope,
  FaRegClipboard,
} from 'react-icons/fa';
import { useSnackbar } from './Snackbar';

enum Network {
  Facebook,
  Twitter,
  Email,
  Clipboard,
}

function linkName(network: Network): string {
  switch (network) {
    case Network.Facebook:
      return 'Facebook';
    case Network.Twitter:
      return 'Twitter';
    case Network.Email:
      return 'Email';
    case Network.Clipboard:
      return 'Copy';
  }
}

function colors(network: Network): string {
  switch (network) {
    case Network.Facebook:
      return '#3b5998';
    case Network.Twitter:
      return '#55acee';
    case Network.Email:
      return '#777777';
    case Network.Clipboard:
      return '#777777';
  }
}

function url(network: Network, path: string, text: string): string {
  const urlToShare = encodeURIComponent('https://crosshare.org' + path);
  const textToShare = encodeURIComponent(text);
  switch (network) {
    case Network.Facebook:
      return 'https://facebook.com/sharer/sharer.php?u=' + urlToShare;
    case Network.Twitter:
      return (
        'https://twitter.com/intent/tweet/?text=' +
        textToShare +
        '&url=' +
        urlToShare
      );
    case Network.Email:
      return 'mailto:?subject=' + textToShare + '&body=' + urlToShare;
    case Network.Clipboard:
      return '#';
  }
}

function icon(network: Network): ReactNode {
  switch (network) {
    case Network.Facebook:
      return <FaFacebook css={{ verticalAlign: 'text-bottom' }} />;
    case Network.Twitter:
      return <FaTwitter css={{ verticalAlign: 'text-bottom' }} />;
    case Network.Email:
      return <FaEnvelope css={{ verticalAlign: 'text-bottom' }} />;
    case Network.Clipboard:
      return <FaRegClipboard css={{ verticalAlign: 'text-bottom' }} />;
  }
}

interface SharingButtonProps extends SharingButtonsProps {
  network: Network;
}

function SharingButton({ network, path, text }: SharingButtonProps) {
  const { showSnackbar } = useSnackbar();

  return (
    <a
      css={{
        whiteSpace: 'nowrap',
        margin: '1em 0.2em 0',
        padding: '0.2em 0.5em',
        borderRadius: '0.3em',
        color: '#fff',
        backgroundColor: mix(colors(network), 'black', 0.3),
        ['&:hover, &:active']: {
          backgroundColor: mix(colors(network), 'black', 0.4),
          color: '#fff',
          textDecoration: 'none',
        },
      }}
      href={url(network, path, text)}
      onClick={(e) => {
        if (network !== Network.Clipboard) {
          return;
        }
        e.preventDefault();

        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(`${text} https://crosshare.org${path}`)
            .then(
              function () {
                showSnackbar('Copied to clipboard');
              },
              function (err) {
                console.error('Could not copy text: ', err);
              }
            );
        } else {
          console.error('No navigator.clipboard');
        }
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={linkName(network)}
    >
      {icon(network)}
      <span css={{ marginLeft: '0.3em' }}>{linkName(network)}</span>
    </a>
  );
}

interface SharingButtonsProps {
  path: string;
  text: string;
}

export function SharingButtons(props: SharingButtonsProps) {
  return (
    <div
      css={{
        justifyContent: 'center',
        marginBottom: '1em',
        display: 'flex',
        flexWrap: 'wrap',
      }}
    >
      <b css={{ marginRight: '0.3em', marginTop: '1.2em' }}>Share:</b>
      <SharingButton network={Network.Facebook} {...props} />
      <SharingButton network={Network.Twitter} {...props} />
      <SharingButton network={Network.Email} {...props} />
      <SharingButton network={Network.Clipboard} {...props} />
    </div>
  );
}
