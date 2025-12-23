import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  minimum: 0.08,
  easing: 'ease',
  speed: 200,
  trickleSpeed: 200,
});

export const startProgress = () => {
  NProgress.start();
};

export const doneProgress = () => {
  NProgress.done();
};

export default NProgress;
